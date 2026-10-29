"""Order lookups from the website, how to pay, and help."""
import discord
from discord import app_commands, ui
from discord.ext import commands

import embeds
import store
from checks import is_admin, is_support
from config import BOT_NAME, STORE_URL


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
