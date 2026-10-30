"""Tickets: the panel, private ticket channels, claiming and closing, transcripts, order details inside tickets, and
closing tickets that have gone quiet. The AI assistant (cogs/assistant.py) answers in them."""
import io
import logging
from datetime import timedelta

import discord
from discord import app_commands, ui
from discord.ext import commands, tasks

import database
import embeds
import store
import transcript
from checks import is_admin, is_support
from cogs.orders import TrackModal, grant_customer_role
from config import ADMIN_IDS, BOT_NAME, COLOR_EMBER, COLOR_OK, COLOR_WARN, STORE_URL

log = logging.getLogger("tracer.tickets")

# A ticket waiting on the customer this long gets a reminder, and closes after the same again.
IDLE = timedelta(hours=24)

# Channel names start with these, e.g. order-0012.
CHANNEL_PREFIX = {"purchase": "order", "support": "support", "warranty": "warranty", "reseller": "reseller"}
CATEGORY_NAMES = {"purchase": "Order Tickets", "support": "Support Tickets", "warranty": "Warranty Tickets", "reseller": "Reseller Tickets"}
DETAILS_LABEL = {"purchase": "What do you need help with?", "support": "What's happening?", "warranty": "What's wrong with it?", "reseller": "Tell us about your business"}
FULL_ACCESS = dict(view_channel=True, send_messages=True, read_message_history=True, attach_files=True, embed_links=True)


class TicketModal(ui.Modal):
    """Asks for the details, and for an order number with its email on order, support and warranty tickets."""

    def __init__(self, category: str):
        super().__init__(title=f"{embeds.kind(category)['label']} ticket")
        self.category = category
        self.order = self.email = None
        if category != "reseller":
            required = category == "warranty"
            self.order = ui.TextInput(label="Order number" if required else "Order number (if you have one)", placeholder="TCL-AB12CD", required=required, max_length=10)
            self.email = ui.TextInput(label="Email you ordered with", placeholder="you@example.com", required=required, max_length=191)
            self.add_item(self.order)
            self.add_item(self.email)
        self.details = ui.TextInput(label=DETAILS_LABEL[category], style=discord.TextStyle.paragraph, required=category != "purchase", max_length=1000)
        self.add_item(self.details)

    async def on_submit(self, interaction: discord.Interaction):
        number = email = None
        if self.order and self.order.value.strip():
            number = store.clean_number(self.order.value)
            if not number:
                return await interaction.response.send_message(embed=embeds.error("That order number doesn't look right. It's on your confirmation email, for example `TCL-AB12CD`."), ephemeral=True)
            email = self.email.value.strip()
            if not email:
                return await interaction.response.send_message(embed=embeds.error("Add the email you ordered with too, so we can find your order."), ephemeral=True)
        await create_ticket(interaction, self.category, self.details.value.strip(), number, email)


async def create_ticket(interaction: discord.Interaction, category: str, description: str, order_number: str | None, email: str | None):
    guild = interaction.guild
    if not guild:
        return await interaction.response.send_message("Tickets only work in the server.", ephemeral=True)
    await interaction.response.send_message("Creating your ticket…", ephemeral=True)

    label = embeds.kind(category)["label"]
    if any(t["category"] == category for t in await database.get_user_open_tickets(guild.id, interaction.user.id)):
        return await interaction.edit_original_response(content=None, embed=embeds.error(f"You already have an open **{label}** ticket. Please carry on there, or close it first."))

    config = await database.get_config(guild.id)
    number = await database.next_ticket_number(guild.id)
    parent = await ticket_category(guild, config, category)

    overwrites = {
        guild.default_role: discord.PermissionOverwrite(view_channel=False),
        interaction.user: discord.PermissionOverwrite(**FULL_ACCESS),
        guild.me: discord.PermissionOverwrite(view_channel=True, send_messages=True, read_message_history=True, manage_channels=True, manage_messages=True),
    }
    staff_roles = [role for role in map(guild.get_role, config["support_role_ids"]) if role]
    for role in staff_roles:
        overwrites[role] = discord.PermissionOverwrite(**FULL_ACCESS)
    for admin_id in ADMIN_IDS:
        if member := guild.get_member(admin_id):
            overwrites[member] = discord.PermissionOverwrite(**FULL_ACCESS, manage_channels=True, manage_messages=True)

    topic = f"{label} ticket #{number:04d} · {interaction.user.display_name}" + (f" · {order_number}" if order_number else "")
    try:
        channel = await guild.create_text_channel(name=f"{CHANNEL_PREFIX[category]}-{number:04d}", category=parent, overwrites=overwrites, topic=topic)
    except discord.Forbidden:
        return await interaction.edit_original_response(content=None, embed=embeds.error("I don't have permission to create channels. Please tell the team."))

    await database.create_ticket(channel.id, guild.id, interaction.user.id, category, number, description, order_number)
    # Mentioning the customer and the support roles notifies them.
    mentions = " ".join(m.mention for m in (interaction.user, *staff_roles))
    await channel.send(mentions, embed=embeds.ticket_welcome(interaction.user, category, number, description, order_number), view=TicketActionView())
    if order_number:
        await channel.send(embed=await _order_for_ticket(interaction.user, order_number, email))
    await interaction.edit_original_response(content=f"Your ticket is ready: {channel.mention}")
    # The AI assistant (cogs/assistant.py) writes the first answer.
    interaction.client.dispatch("ticket_open", channel, interaction.user)


async def ticket_category(guild: discord.Guild, config: dict, category: str) -> discord.CategoryChannel | None:
    """The saved category for this kind of ticket. If none is saved or it was deleted, the one with the usual name is
    used, or made, and saved, so tickets never land at the top of the server. None only if the bot can't make it."""
    saved = guild.get_channel(config.get(f"{category}_category_id") or 0)
    if isinstance(saved, discord.CategoryChannel):
        return saved
    name = CATEGORY_NAMES[category]
    try:
        found = discord.utils.get(guild.categories, name=name) or await guild.create_category(name, reason=f"Ticket category for {BOT_NAME}")
    except discord.Forbidden:
        return None
    await database.set_category_id(guild.id, category, found.id)
    return found


async def _order_for_ticket(customer: discord.Member, number: str, email: str | None) -> discord.Embed:
    """The customer's order, shown in their ticket so the team has it to hand: green when verified, red when not."""
    try:
        found = await store.get_order(number, email)
    except store.StoreError as err:
        return embeds.note("Order lookup", f"Couldn't look up **{number}** just now: {err}", COLOR_WARN)
    if not found:
        return embeds.note("Order not verified", f"Order **{number}** wasn't found for that email. The team will check it with you.", COLOR_EMBER)
    await grant_customer_role(customer, found)
    embed = embeds.order(found)
    embed.colour = COLOR_OK
    return embed


class TicketPanelView(ui.View):
    """The buttons under /ticketpanel. Custom IDs stay fixed so posted panels keep working after restarts."""

    def __init__(self):
        super().__init__(timeout=None)
        self.add_item(ui.Button(label="Shop", emoji="\U0001f310", url=f"{STORE_URL}/shop", row=1))

    async def _open(self, interaction: discord.Interaction, category: str):
        await interaction.response.send_modal(TicketModal(category))

    @ui.button(label="Orders", emoji="\U0001f6d2", style=discord.ButtonStyle.danger, custom_id="ticket_purchase", row=0)
    async def orders_btn(self, interaction: discord.Interaction, _):
        await self._open(interaction, "purchase")

    @ui.button(label="Tech support", emoji="\U0001f6e0️", style=discord.ButtonStyle.secondary, custom_id="ticket_support", row=0)
    async def support_btn(self, interaction: discord.Interaction, _):
        await self._open(interaction, "support")

    @ui.button(label="Warranty", emoji="\U0001f6e1️", style=discord.ButtonStyle.secondary, custom_id="ticket_warranty", row=0)
    async def warranty_btn(self, interaction: discord.Interaction, _):
        await self._open(interaction, "warranty")

    @ui.button(label="Reseller", emoji="\U0001f91d", style=discord.ButtonStyle.secondary, custom_id="ticket_reseller", row=0)
    async def reseller_btn(self, interaction: discord.Interaction, _):
        await self._open(interaction, "reseller")

    @ui.button(label="Track order", emoji="\U0001f4e6", style=discord.ButtonStyle.success, custom_id="ticket_track", row=1)
    async def track_btn(self, interaction: discord.Interaction, _):
        await interaction.response.send_modal(TrackModal())


async def _set_talking(channel: discord.TextChannel, allowed: bool):
    """Lock (closed) or unlock (reopened) everyone in the ticket except the bot."""
    for target, overwrite in channel.overwrites.items():
        if target in (channel.guild.me, channel.guild.default_role):
            continue
        overwrite.send_messages = allowed
        await channel.set_permissions(target, overwrite=overwrite)


async def _close(channel: discord.TextChannel, by: discord.abc.User, ticket: dict, idle: bool = False):
    await database.close_ticket(channel.id, by.id)
    await _set_talking(channel, False)
    await channel.send(embed=embeds.ticket_closed(by, idle), view=ClosedTicketView())
    await _dm_transcript(channel, await database.get_ticket(channel.id) or ticket)


async def _reopen(channel: discord.TextChannel, by: discord.abc.User):
    await database.reopen_ticket(channel.id)
    await _set_talking(channel, True)
    await channel.send(embed=embeds.ticket_reopened(by), view=TicketActionView())


class TicketActionView(ui.View):
    def __init__(self):
        super().__init__(timeout=None)

    @ui.button(label="Close", emoji="\U0001f512", style=discord.ButtonStyle.danger, custom_id="ticket_close")
    async def close_btn(self, interaction: discord.Interaction, _):
        await ask_to_close(interaction)

    @ui.button(label="Claim", emoji="\U0001f3ab", style=discord.ButtonStyle.secondary, custom_id="ticket_claim")
    async def claim_btn(self, interaction: discord.Interaction, _):
        if not await is_support(interaction):
            return await interaction.response.send_message(embed=embeds.no_permission(), ephemeral=True)
        if not await database.get_ticket(interaction.channel.id):
            return await interaction.response.send_message(embed=embeds.error("This isn't a ticket channel."), ephemeral=True)
        # The team has it now, so the AI assistant stops answering here.
        await database.update_ticket(interaction.channel.id, claimed_by=interaction.user.id, ai_off=1)
        await interaction.response.send_message(embed=embeds.ticket_claimed(interaction.user))


async def ask_to_close(interaction: discord.Interaction):
    ticket = await database.get_ticket(interaction.channel.id)
    if not ticket:
        return await interaction.response.send_message(embed=embeds.error("This isn't a ticket channel."), ephemeral=True)
    if ticket["status"] == "closed":
        return await interaction.response.send_message(embed=embeds.error("This ticket is already closed."), ephemeral=True)
    if interaction.user.id != ticket["user_id"] and not await is_support(interaction):
        return await interaction.response.send_message(embed=embeds.no_permission(), ephemeral=True)
    await interaction.response.send_message("Close this ticket?", view=ConfirmView(interaction.user.id, "Close ticket", _confirm_close), ephemeral=True)


async def _confirm_close(interaction: discord.Interaction):
    ticket = await database.get_ticket(interaction.channel.id)
    if not ticket or ticket["status"] == "closed":
        return await interaction.response.edit_message(content="This ticket is already closed.", view=None)
    await interaction.response.edit_message(content="Ticket closed.", view=None)
    await _close(interaction.channel, interaction.user, ticket)


class ConfirmView(ui.View):
    """A one-off confirm/cancel pair, usable only by whoever asked."""

    def __init__(self, requester_id: int, label: str, on_confirm):
        super().__init__(timeout=60)
        self.requester_id = requester_id
        self.on_confirm = on_confirm
        self.confirm_btn.label = label

    async def interaction_check(self, interaction: discord.Interaction) -> bool:
        return interaction.user.id == self.requester_id

    @ui.button(label="Confirm", style=discord.ButtonStyle.danger)
    async def confirm_btn(self, interaction: discord.Interaction, _):
        self.stop()
        await self.on_confirm(interaction)

    @ui.button(label="Cancel", style=discord.ButtonStyle.secondary)
    async def cancel_btn(self, interaction: discord.Interaction, _):
        self.stop()
        await interaction.response.edit_message(content="Cancelled.", view=None)


class ClosedTicketView(ui.View):
    def __init__(self):
        super().__init__(timeout=None)

    @ui.button(label="Reopen", emoji="\U0001f513", style=discord.ButtonStyle.success, custom_id="ticket_reopen")
    async def reopen_btn(self, interaction: discord.Interaction, _):
        if not await is_support(interaction):
            return await interaction.response.send_message(embed=embeds.no_permission(), ephemeral=True)
        ticket = await database.get_ticket(interaction.channel.id)
        if not ticket or ticket["status"] != "closed":
            return await interaction.response.send_message(embed=embeds.error("This ticket isn't closed."), ephemeral=True)
        await interaction.response.edit_message(view=None)
        await _reopen(interaction.channel, interaction.user)

    @ui.button(label="Delete", emoji="\U0001f5d1️", style=discord.ButtonStyle.danger, custom_id="ticket_delete")
    async def delete_btn(self, interaction: discord.Interaction, _):
        await delete_ticket(interaction)


async def delete_ticket(interaction: discord.Interaction):
    if not is_admin(interaction):
        return await interaction.response.send_message(embed=embeds.error("Only admins can delete tickets."), ephemeral=True)
    ticket = await database.get_ticket(interaction.channel.id)
    if not ticket:
        return await interaction.response.send_message(embed=embeds.error("This isn't a ticket channel."), ephemeral=True)
    await interaction.response.send_message("Saving the transcript and deleting this ticket…")
    await _log_transcript(interaction.channel, ticket)
    await database.mark_deleted(interaction.channel.id, interaction.user.id)
    await interaction.channel.delete(reason=f"Ticket deleted by {interaction.user}")


# --- Transcripts ---

async def _transcript(channel: discord.TextChannel, ticket: dict) -> tuple[bytes, str, int]:
    messages = [m async for m in channel.history(limit=None, oldest_first=True)]
    html = transcript.generate_html(messages, ticket, channel.guild.name).encode("utf-8")
    return html, f"transcript-{CHANNEL_PREFIX.get(ticket['category'], 'ticket')}-{ticket['number']:04d}.html", len(messages)


async def _dm_transcript(channel: discord.TextChannel, ticket: dict):
    """The customer gets a copy when their ticket closes (if their DMs are open)."""
    try:
        html, filename, _ = await _transcript(channel, ticket)
        member = await channel.guild.fetch_member(ticket["user_id"])
        await member.send(embed=embeds.ticket_dm(ticket), file=discord.File(io.BytesIO(html), filename=filename))
    except (discord.Forbidden, discord.NotFound):
        pass
    except Exception:
        log.exception("DM transcript failed for channel %s", channel.id)


async def _log_transcript(channel: discord.TextChannel, ticket: dict):
    """Saved to the transcript channel before a ticket channel is deleted."""
    config = await database.get_config(channel.guild.id)
    log_channel = channel.guild.get_channel(config.get("transcript_channel_id") or 0)
    if not log_channel:
        return
    try:
        html, filename, count = await _transcript(channel, ticket)
        creator = channel.guild.get_member(ticket["user_id"])
        closer = channel.guild.get_member(ticket.get("closed_by") or 0)
        await log_channel.send(embed=embeds.transcript_log(ticket, creator, closer, count), file=discord.File(io.BytesIO(html), filename=filename))
    except Exception:
        log.exception("Logging transcript failed for channel %s", channel.id)


class TicketsCog(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    async def cog_load(self):
        self.idle_sweep.start()

    async def cog_unload(self):
        self.idle_sweep.cancel()

    @tasks.loop(minutes=30)
    async def idle_sweep(self):
        """Tickets waiting on the customer: a reminder after a day without a reply, and closed after another day.
        Tickets waiting on the team (the customer wrote last) are left alone."""
        now = discord.utils.utcnow()
        for ticket in await database.get_open_tickets():
            channel = self.bot.get_channel(ticket["channel_id"])
            if not isinstance(channel, discord.TextChannel):
                continue
            last = [m async for m in channel.history(limit=1)]
            if not last or last[0].author.id == ticket["user_id"] or now - last[0].created_at < IDLE:
                continue
            try:
                if embeds.is_reminder(last[0]):
                    await _close(channel, self.bot.user, ticket, idle=True)
                else:
                    await channel.send(f"<@{ticket['user_id']}>", embed=embeds.ticket_reminder())
            except discord.HTTPException:
                log.exception("Idle check failed for ticket channel %s", channel.id)

    @idle_sweep.before_loop
    async def _before_idle_sweep(self):
        await self.bot.wait_until_ready()

    @app_commands.command(name="ticketpanel", description="Post the ticket buttons in this channel")
    async def ticketpanel_cmd(self, interaction: discord.Interaction):
        if not is_admin(interaction):
            return await interaction.response.send_message(embed=embeds.no_permission(), ephemeral=True)
        await interaction.response.send_message(embed=embeds.ticket_panel(), view=TicketPanelView())

    @app_commands.command(name="ticketsetup", description="Pick the transcript channel, ticket categories and support role")
    @app_commands.describe(
        transcript_channel="Where transcripts are saved",
        orders_category="Category for Orders tickets",
        support_category="Category for Tech support tickets",
        warranty_category="Category for Warranty tickets",
        reseller_category="Category for Reseller tickets",
        support_role="Role that can see and handle tickets",
        customer_role="Role given to people who verify a paid order",
    )
    async def ticketsetup_cmd(
        self,
        interaction: discord.Interaction,
        transcript_channel: discord.TextChannel | None = None,
        orders_category: discord.CategoryChannel | None = None,
        support_category: discord.CategoryChannel | None = None,
        warranty_category: discord.CategoryChannel | None = None,
        reseller_category: discord.CategoryChannel | None = None,
        support_role: discord.Role | None = None,
        customer_role: discord.Role | None = None,
    ):
        if not is_admin(interaction):
            return await interaction.response.send_message(embed=embeds.no_permission(), ephemeral=True)
        guild = interaction.guild
        if transcript_channel:
            await database.set_config(guild.id, transcript_channel_id=transcript_channel.id)
        for key, cat in (("purchase", orders_category), ("support", support_category), ("warranty", warranty_category), ("reseller", reseller_category)):
            if cat:
                await database.set_category_id(guild.id, key, cat.id)
        if support_role:
            await database.add_support_role(guild.id, support_role.id)
        if customer_role:
            await database.set_config(guild.id, customer_role_id=customer_role.id)
        await interaction.response.send_message(embed=await self._summary(guild), ephemeral=True)

    async def _summary(self, guild: discord.Guild, heading: str = "Ticket setup saved") -> discord.Embed:
        config = await database.get_config(guild.id)
        categories = {key: guild.get_channel(config.get(f"{key}_category_id") or 0) for key in database.TICKET_TYPES}
        return embeds.setup_summary(
            guild.get_channel(config.get("transcript_channel_id") or 0), categories, config["support_role_ids"], guild.get_role(config.get("customer_role_id") or 0), heading
        )

    @app_commands.command(name="ticketautosetup", description="Create whatever's missing: support role, transcript channel, categories, Customer role")
    async def ticketautosetup_cmd(self, interaction: discord.Interaction):
        if not is_admin(interaction):
            return await interaction.response.send_message(embed=embeds.no_permission(), ephemeral=True)
        await interaction.response.defer(thinking=True)
        guild = interaction.guild
        reason = f"Set up by {BOT_NAME}"
        config = await database.get_config(guild.id)
        # Whatever is already set up is kept; only what's missing (or was deleted) is made.
        try:
            staff = [r for r in map(guild.get_role, config["support_role_ids"]) if r]
            if not staff:
                staff = [discord.utils.get(guild.roles, name="Support Team") or await guild.create_role(name="Support Team", mentionable=True, reason=reason)]
                await database.add_support_role(guild.id, staff[0].id)
            if not guild.get_channel(config["transcript_channel_id"] or 0):
                logs = discord.utils.get(guild.text_channels, name="ticket-logs") or await guild.create_text_channel(
                    "ticket-logs",
                    overwrites={
                        guild.default_role: discord.PermissionOverwrite(view_channel=False),
                        guild.me: discord.PermissionOverwrite(view_channel=True, send_messages=True, attach_files=True),
                        **{role: discord.PermissionOverwrite(view_channel=True, read_message_history=True) for role in staff},
                    },
                    reason=reason,
                )
                await database.set_config(guild.id, transcript_channel_id=logs.id)
            if not guild.get_role(config["customer_role_id"] or 0):
                customer = discord.utils.get(guild.roles, name="Customer") or await guild.create_role(name="Customer", reason=reason)
                await database.set_config(guild.id, customer_role_id=customer.id)
            for key in CATEGORY_NAMES:
                await ticket_category(guild, config, key)
        except discord.Forbidden:
            return await interaction.followup.send(embed=embeds.error("I need the Manage Roles and Manage Channels permissions for this."))
        await interaction.followup.send(embed=await self._summary(guild, "Tickets are set up"))

    @app_commands.command(name="removesupportrole", description="Stop a role from seeing and handling tickets")
    @app_commands.describe(role="Role to remove")
    async def removesupportrole_cmd(self, interaction: discord.Interaction, role: discord.Role):
        if not is_admin(interaction):
            return await interaction.response.send_message(embed=embeds.no_permission(), ephemeral=True)
        await database.remove_support_role(interaction.guild.id, role.id)
        await interaction.response.send_message(embed=embeds.note("Support role removed", f"{role.mention} no longer sees new tickets.", COLOR_EMBER), ephemeral=True)

    @app_commands.command(name="rename", description="Rename this ticket channel")
    @app_commands.describe(name="New channel name")
    async def rename_cmd(self, interaction: discord.Interaction, name: str):
        if not await database.get_ticket(interaction.channel.id):
            return await interaction.response.send_message(embed=embeds.error("This isn't a ticket channel."), ephemeral=True)
        if not await is_support(interaction):
            return await interaction.response.send_message(embed=embeds.no_permission(), ephemeral=True)
        old = interaction.channel.name
        await interaction.channel.edit(name=name)
        await interaction.response.send_message(embed=embeds.note("Ticket renamed", f"`{old}` → `{interaction.channel.name}`"))

    @app_commands.command(name="add", description="Add someone to this ticket")
    @app_commands.describe(user="Who to add")
    async def add_cmd(self, interaction: discord.Interaction, user: discord.Member):
        ticket = await database.get_ticket(interaction.channel.id)
        if not ticket:
            return await interaction.response.send_message(embed=embeds.error("This isn't a ticket channel."), ephemeral=True)
        if interaction.user.id != ticket["user_id"] and not await is_support(interaction):
            return await interaction.response.send_message(embed=embeds.no_permission(), ephemeral=True)
        await interaction.channel.set_permissions(user, **FULL_ACCESS)
        await interaction.response.send_message(embed=embeds.note("Added to ticket", f"{user.mention} can now see this ticket.", COLOR_OK))

    @app_commands.command(name="remove", description="Remove someone from this ticket")
    @app_commands.describe(user="Who to remove")
    async def remove_cmd(self, interaction: discord.Interaction, user: discord.Member):
        ticket = await database.get_ticket(interaction.channel.id)
        if not ticket:
            return await interaction.response.send_message(embed=embeds.error("This isn't a ticket channel."), ephemeral=True)
        if not await is_support(interaction):
            return await interaction.response.send_message(embed=embeds.no_permission(), ephemeral=True)
        if user.id == ticket["user_id"]:
            return await interaction.response.send_message(embed=embeds.error("You can't remove the person who opened the ticket."), ephemeral=True)
        await interaction.channel.set_permissions(user, overwrite=None)
        await interaction.response.send_message(embed=embeds.note("Removed from ticket", f"{user.mention} can no longer see this ticket.", COLOR_EMBER))

    @app_commands.command(name="close", description="Close this ticket")
    async def close_cmd(self, interaction: discord.Interaction):
        await ask_to_close(interaction)

    @app_commands.command(name="reopen", description="Reopen this closed ticket")
    async def reopen_cmd(self, interaction: discord.Interaction):
        if not await is_support(interaction):
            return await interaction.response.send_message(embed=embeds.no_permission(), ephemeral=True)
        ticket = await database.get_ticket(interaction.channel.id)
        if not ticket or ticket["status"] != "closed":
            return await interaction.response.send_message(embed=embeds.error("This isn't a closed ticket."), ephemeral=True)
        await interaction.response.send_message("Reopening…", ephemeral=True)
        await _reopen(interaction.channel, interaction.user)

    @app_commands.command(name="delete", description="Save the transcript and delete this ticket")
    async def delete_cmd(self, interaction: discord.Interaction):
        await delete_ticket(interaction)

    @app_commands.command(name="deletealltickets", description="Save transcripts and delete every open ticket")
    async def deletealltickets_cmd(self, interaction: discord.Interaction):
        if not is_admin(interaction):
            return await interaction.response.send_message(embed=embeds.error("Only admins can do this."), ephemeral=True)
        open_tickets = [t for t in await database.get_all_tickets(interaction.guild.id) if t["status"] == "open"]
        if not open_tickets:
            return await interaction.response.send_message("There are no open tickets.", ephemeral=True)
        await interaction.response.send_message(
            f"Delete all **{len(open_tickets)}** open tickets? Transcripts are saved and sent to customers first.",
            view=ConfirmView(interaction.user.id, f"Delete {len(open_tickets)} tickets", self._delete_all),
            ephemeral=True,
        )

    async def _delete_all(self, interaction: discord.Interaction):
        await interaction.response.edit_message(content="Deleting…", view=None)
        count = 0
        for t in await database.get_all_tickets(interaction.guild.id):
            if t["status"] != "open":
                continue
            if channel := interaction.guild.get_channel(t["channel_id"]):
                await _log_transcript(channel, t)
                await _dm_transcript(channel, t)
                try:
                    await channel.delete(reason=f"All tickets deleted by {interaction.user}")
                except discord.NotFound:
                    pass
            await database.mark_deleted(t["channel_id"], interaction.user.id)
            count += 1
        await interaction.edit_original_response(content=f"Deleted **{count}** tickets.")

    @app_commands.command(name="ticketstats", description="Ticket counts by type")
    async def ticketstats_cmd(self, interaction: discord.Interaction):
        if not await is_support(interaction):
            return await interaction.response.send_message(embed=embeds.no_permission(), ephemeral=True)
        tickets = await database.get_all_tickets(interaction.guild.id)
        await interaction.response.send_message(embed=embeds.ticket_stats(interaction.guild.name, tickets), ephemeral=True)


async def setup(bot: commands.Bot):
    await bot.add_cog(TicketsCog(bot))
