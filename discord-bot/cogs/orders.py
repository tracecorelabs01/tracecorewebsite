"""Orders: /track (your own orders, once your Discord is linked to them with an email code), /order for staff, the
Customer role, how to pay, and help."""
import logging

import discord
from discord import app_commands, ui
from discord.ext import commands

import database
import embeds
import store
from checks import admin_only, is_admin, is_support, staff_only
from config import BOT_NAME, STORE_URL

log = logging.getLogger("tracer.orders")


async def grant_customer_role(user: discord.abc.User, order: dict):
    """Someone who verifies a paid order (order number + its email) gets the server's Customer role, if one is set."""
    if not isinstance(user, discord.Member) or order.get("paymentStatus") != "paid":
        return
    config = await database.get_config(user.guild.id)
    role = user.guild.get_role(config.get("customer_role_id") or 0)
    if role and role not in user.roles:
        try:
            await user.add_roles(role, reason=f"Verified paid order {order.get('number')}")
        except discord.HTTPException:
            log.warning("Couldn't give %s the Customer role (is the bot's role above it?)", user)


async def reply_with_order(interaction: discord.Interaction, raw_number: str, email: str | None, staff: bool = False):
    """Look an order up on the website and answer privately. Customers must give the order's email; staff don't."""
    number = store.clean_number(raw_number)
    if not number:
        return await interaction.response.send_message(
            embed=embeds.error("That doesn't look like an order number. It's on your confirmation email, for example `TCL-AB12CD`."), ephemeral=True
        )
    await interaction.response.defer(ephemeral=True, thinking=True)
    try:
        found = await store.get_order(number, None if staff else email)
    except store.StoreError as err:
        return await interaction.followup.send(embed=embeds.error(str(err)), ephemeral=True)
    if not found:
        return await interaction.followup.send(embed=embeds.order_not_found(number, with_email=not staff), ephemeral=True)
    if not staff:
        await grant_customer_role(interaction.user, found)
    await interaction.followup.send(embed=embeds.order(found, staff=staff), ephemeral=True)


class TrackModal(ui.Modal, title="Track one order"):
    number = ui.TextInput(label="Order number", placeholder="TCL-AB12CD", max_length=10)
    email = ui.TextInput(label="Email you ordered with", placeholder="you@example.com", max_length=191)

    async def on_submit(self, interaction: discord.Interaction):
        await reply_with_order(interaction, self.number.value, self.email.value)


# --- /track: your own orders, linked once with an email code ---

async def show_my_orders(interaction: discord.Interaction):
    """/track and every Track my orders button: the person's orders if their Discord is linked, else how to link it."""
    await interaction.response.defer(ephemeral=True, thinking=True)
    await _send_my_orders(interaction)


async def _send_my_orders(interaction: discord.Interaction):
    try:
        # Always the Discord account using the bot, so nobody can see someone else's orders.
        data = await store.get_discord_orders(interaction.user.id)
    except store.StoreError as err:
        return await interaction.followup.send(embed=embeds.error(str(err)), ephemeral=True)
    if not data.get("linked"):
        return await interaction.followup.send(embed=embeds.not_linked(), view=LinkView(), ephemeral=True)
    orders = data["orders"]
    if paid := next((o for o in orders if o["paymentStatus"] == "paid"), None):
        await grant_customer_role(interaction.user, paid)
    if not orders:
        return await interaction.followup.send(embed=embeds.my_orders([]), ephemeral=True)
    await interaction.followup.send(embed=embeds.my_orders(orders), view=OrderPicker(orders), ephemeral=True)


class OrderPicker(ui.View):
    """A menu of the person's orders under /track; picking one shows its details in the same message."""

    def __init__(self, orders: list[dict]):
        super().__init__(timeout=900)
        self.orders = {o["number"]: o for o in orders}
        self.pick.options = [discord.SelectOption(label=embeds.order_title(o), description=embeds.order_line(o), value=o["number"]) for o in orders[:25]]

    @ui.select(placeholder="Pick an order for its details")
    async def pick(self, interaction: discord.Interaction, select: ui.Select):
        await interaction.response.edit_message(embed=embeds.order(self.orders[select.values[0]]), view=self)


class LinkView(ui.View):
    """For someone whose Discord isn't linked yet: link it with an email code, or look up one order."""

    def __init__(self):
        super().__init__(timeout=900)

    @ui.button(label="Link with my email", emoji="\U0001f517", style=discord.ButtonStyle.primary)
    async def link_btn(self, interaction: discord.Interaction, _):
        await interaction.response.send_modal(LinkEmailModal())

    @ui.button(label="Track one order", emoji="\U0001f4e6", style=discord.ButtonStyle.secondary)
    async def one_btn(self, interaction: discord.Interaction, _):
        await interaction.response.send_modal(TrackModal())


class LinkEmailModal(ui.Modal, title="Link your Discord"):
    email = ui.TextInput(label="Email you ordered with", placeholder="you@example.com", max_length=191)

    async def on_submit(self, interaction: discord.Interaction):
        await _send_link_code(interaction, self.email.value.strip())


async def _send_link_code(interaction: discord.Interaction, email: str):
    await interaction.response.defer(ephemeral=True, thinking=True)
    try:
        result = await store.start_discord_link(interaction.user.id, email)
    except store.StoreError as err:
        return await interaction.followup.send(embed=embeds.error(str(err)), ephemeral=True)
    if not result["ok"]:
        return await interaction.followup.send(embed=embeds.error(result["message"]), ephemeral=True)
    await interaction.followup.send(embed=embeds.note("Check your email", f"{result['message']}\n\nPress **Enter the code** when it arrives."), view=CodeView(email), ephemeral=True)


class CodeView(ui.View):
    def __init__(self, email: str):
        super().__init__(timeout=900)
        self.email = email

    @ui.button(label="Enter the code", style=discord.ButtonStyle.primary)
    async def code_btn(self, interaction: discord.Interaction, _):
        await interaction.response.send_modal(LinkCodeModal(self.email))

    @ui.button(label="Send a new code", style=discord.ButtonStyle.secondary)
    async def resend_btn(self, interaction: discord.Interaction, _):
        await _send_link_code(interaction, self.email)


class LinkCodeModal(ui.Modal, title="Enter your code"):
    code = ui.TextInput(label="6-digit code from the email", placeholder="123456", min_length=6, max_length=6)

    def __init__(self, email: str):
        super().__init__()
        self.email = email

    async def on_submit(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True, thinking=True)
        try:
            result = await store.finish_discord_link(interaction.user.id, self.email, self.code.value, interaction.user.name)
        except store.StoreError as err:
            return await interaction.followup.send(embed=embeds.error(str(err)), ephemeral=True)
        if not result["ok"]:
            return await interaction.followup.send(embed=embeds.error(result["message"]), view=CodeView(self.email), ephemeral=True)
        await _send_my_orders(interaction)


class TrackView(ui.View):
    """Under /intro and the welcome message. Persistent, so the button keeps working after a restart."""

    def __init__(self):
        super().__init__(timeout=None)
        self.add_item(ui.Button(label="Shop", url=f"{STORE_URL}/shop"))

    @ui.button(label="Track my orders", emoji="\U0001f4e6", style=discord.ButtonStyle.primary, custom_id="track_orders")
    async def track_btn(self, interaction: discord.Interaction, _):
        await show_my_orders(interaction)


class OrdersCog(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @app_commands.command(name="track", description="Your orders: status, tracking and warranty")
    async def track_cmd(self, interaction: discord.Interaction):
        await show_my_orders(interaction)

    @app_commands.command(name="order", description="Look up any order (support team)")
    @staff_only
    @app_commands.describe(order="Order number, e.g. TCL-AB12CD")
    async def order_cmd(self, interaction: discord.Interaction, order: str):
        if not await is_support(interaction):
            return await interaction.response.send_message(embed=embeds.no_permission(), ephemeral=True)
        await reply_with_order(interaction, order, None, staff=True)

    @app_commands.command(name="intro", description="Post an introduction to the bot in this channel (admins)")
    @admin_only
    @app_commands.guild_only()
    async def intro_cmd(self, interaction: discord.Interaction):
        if not is_admin(interaction):
            return await interaction.response.send_message(embed=embeds.no_permission(), ephemeral=True)
        config = await database.get_config(interaction.guild.id)
        await interaction.response.send_message(embed=embeds.intro(config["panel_channel_id"]), view=TrackView())

    @app_commands.command(name="payment", description="How to pay for an order")
    async def payment_cmd(self, interaction: discord.Interaction):
        view = ui.View()
        view.add_item(ui.Button(label="Shop now", url=f"{STORE_URL}/shop"))
        # Admins post it for everyone; anyone else gets a private copy.
        await interaction.response.send_message(embed=embeds.payment(), view=view, ephemeral=not is_admin(interaction))

    @app_commands.command(name="help", description=f"What {BOT_NAME} can do")
    async def help_cmd(self, interaction: discord.Interaction):
        await interaction.response.send_message(embed=embeds.help_menu(await is_support(interaction)), ephemeral=True)


async def setup(bot: commands.Bot):
    await bot.add_cog(OrdersCog(bot))
