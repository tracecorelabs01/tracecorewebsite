"""The staff wallet: one shared balance admins add to and take from, with notes. Replies are private."""
import discord
from discord import app_commands
from discord.ext import commands

import database
import embeds
from checks import is_admin

MAX_AMOUNT = 1_000_000


class WalletCog(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    async def _check(self, interaction: discord.Interaction, amount: float) -> bool:
        if not is_admin(interaction):
            await interaction.response.send_message(embed=embeds.no_permission(), ephemeral=True)
            return False
        if not 0.01 <= amount <= MAX_AMOUNT:
            await interaction.response.send_message(embed=embeds.error(f"Enter an amount from $0.01 to ${MAX_AMOUNT:,}."), ephemeral=True)
            return False
        return True

    @app_commands.command(name="addfund", description="Add money to the staff wallet")
    @app_commands.describe(amount="Amount in dollars", note="What it's for (optional)")
    async def addfund_cmd(self, interaction: discord.Interaction, amount: float, note: str = ""):
        if not await self._check(interaction, amount):
            return
        await database.add_fund(amount, note[:200], interaction.user.id)
        await interaction.response.send_message(embed=embeds.fund_change(interaction.user, round(amount, 2), note, await database.get_wallet(), added=True), ephemeral=True)

    @app_commands.command(name="removefund", description="Take money from the staff wallet")
    @app_commands.describe(amount="Amount in dollars", note="What it's for (optional)")
    async def removefund_cmd(self, interaction: discord.Interaction, amount: float, note: str = ""):
        if not await self._check(interaction, amount):
            return
        if not await database.remove_fund(amount, note[:200], interaction.user.id):
            return await interaction.response.send_message(embed=embeds.error("There isn't that much in the wallet."), ephemeral=True)
        await interaction.response.send_message(embed=embeds.fund_change(interaction.user, round(amount, 2), note, await database.get_wallet(), added=False), ephemeral=True)

    @app_commands.command(name="walletinfo", description="Staff wallet balance and recent changes")
    async def walletinfo_cmd(self, interaction: discord.Interaction):
        if not is_admin(interaction):
            return await interaction.response.send_message(embed=embeds.no_permission(), ephemeral=True)
        history, total = await database.get_fund_history()
        await interaction.response.send_message(embed=embeds.wallet(await database.get_wallet(), history, total), ephemeral=True)


async def setup(bot: commands.Bot):
    await bot.add_cog(WalletCog(bot))
