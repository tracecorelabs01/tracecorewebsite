"""Order lookups from the website, the Customer role, how to pay, and help."""
import logging

import discord
from discord import app_commands, ui
from discord.ext import commands

import database
import embeds
import store
from checks import is_admin, is_support
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


class TrackModal(ui.Modal, title="Track your order"):
    number = ui.TextInput(label="Order number", placeholder="TCL-AB12CD", max_length=10)
    email = ui.TextInput(label="Email you ordered with", placeholder="you@example.com", max_length=191)

    async def on_submit(self, interaction: discord.Interaction):
        await reply_with_order(interaction, self.number.value, self.email.value)


class OrdersCog(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @app_commands.command(name="track", description="Follow your order: status, tracking and warranty")
    @app_commands.describe(order="Your order number, e.g. TCL-AB12CD", email="The email you ordered with")
    async def track_cmd(self, interaction: discord.Interaction, order: str, email: str):
        await reply_with_order(interaction, order, email)

    @app_commands.command(name="order", description="Look up any order (support team)")
    @app_commands.describe(order="Order number, e.g. TCL-AB12CD")
    async def order_cmd(self, interaction: discord.Interaction, order: str):
        if not await is_support(interaction):
            return await interaction.response.send_message(embed=embeds.no_permission(), ephemeral=True)
        await reply_with_order(interaction, order, None, staff=True)

    @app_commands.command(name="myorders", description="Your orders, once your Discord is linked to your TraceCore Lab account")
    async def myorders_cmd(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True, thinking=True)
        try:
            # Always the ID of whoever ran the command, so nobody can see someone else's orders.
            data = await store.get_discord_orders(interaction.user.id)
        except store.StoreError as err:
            return await interaction.followup.send(embed=embeds.error(str(err)), ephemeral=True)
        if not data.get("linked"):
            view = ui.View()
            view.add_item(ui.Button(label="Open your account", url=f"{STORE_URL}/account"))
            return await interaction.followup.send(embed=embeds.not_linked(), view=view, ephemeral=True)
        if paid := next((o for o in data["orders"] if o["paymentStatus"] == "paid"), None):
            await grant_customer_role(interaction.user, paid)
        await interaction.followup.send(embed=embeds.my_orders(data["orders"]), ephemeral=True)

    @app_commands.command(name="intro", description="Post an introduction to the bot in this channel (admins)")
    async def intro_cmd(self, interaction: discord.Interaction):
        if not is_admin(interaction):
            return await interaction.response.send_message(embed=embeds.no_permission(), ephemeral=True)
        view = ui.View()
        view.add_item(ui.Button(label="Shop", url=f"{STORE_URL}/shop"))
        view.add_item(ui.Button(label="Link your Discord", url=f"{STORE_URL}/account"))
        await interaction.response.send_message(embed=embeds.intro(), view=view)

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
