"""Welcomes new members once they're verified, with what the bot can do for them. Verified means they got the
verified role set in /ticketsetup (the Verified role here, given by the verification bot), or, with no role set,
that they finished Discord's rules screening or joined a server without it. Each member is welcomed once."""
import logging

import discord
from discord import ui
from discord.ext import commands

import database
import embeds
from config import STORE_URL

log = logging.getLogger("tracer.welcome")


def _has(member: discord.Member, role_id: int) -> bool:
    return any(r.id == role_id for r in member.roles)


class WelcomeCog(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_member_join(self, member: discord.Member):
        config = await database.get_config(member.guild.id)
        if not config["verified_role_id"] and not member.pending:
            await self.welcome(member, config)

    @commands.Cog.listener()
    async def on_member_update(self, before: discord.Member, after: discord.Member):
        config = await database.get_config(after.guild.id)
        role_id = config["verified_role_id"]
        if role_id:
            verified = not _has(before, role_id) and _has(after, role_id)
        else:
            verified = before.pending and not after.pending  # finished Discord's rules screening
        if verified:
            await self.welcome(after, config)

    async def welcome(self, member: discord.Member, config: dict):
        if member.bot or not await database.mark_welcomed(member.guild.id, member.id):
            return
        view = ui.View()
        view.add_item(ui.Button(label="Shop", url=f"{STORE_URL}/shop"))
        view.add_item(ui.Button(label="Link your Discord", url=f"{STORE_URL}/account"))
        embed = embeds.welcome(member, config["panel_channel_id"])
        channel = member.guild.get_channel(config["welcome_channel_id"] or 0)
        try:
            # In the welcome channel, mentioning them; with none set, by DM.
            if isinstance(channel, discord.TextChannel):
                await channel.send(member.mention, embed=embed, view=view)
            else:
                await member.send(embed=embed, view=view)
        except discord.HTTPException:
            log.warning("Couldn't welcome %s (closed DMs, or no access to the welcome channel)", member)


async def setup(bot: commands.Bot):
    await bot.add_cog(WelcomeCog(bot))
