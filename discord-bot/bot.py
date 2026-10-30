"""Tracer, the TraceCore Lab Discord bot: support tickets with an AI assistant, and order tracking from the website."""
import itertools
import logging
import sys

import discord
from discord import app_commands
from discord.ext import commands, tasks

import ai
import database
import embeds
from config import BOT_NAME, BOT_TOKEN, STATUS_MESSAGES

log = logging.getLogger("tracer")

ACTIVITY_TYPES = {
    "playing": discord.ActivityType.playing,
    "watching": discord.ActivityType.watching,
    "listening": discord.ActivityType.listening,
    "competing": discord.ActivityType.competing,
}


class Tracer(commands.Bot):
    def __init__(self):
        intents = discord.Intents.default()
        intents.members = True  # to find staff and ticket owners
        intents.message_content = True  # for transcripts, and for the AI assistant to read tickets
        super().__init__(command_prefix=commands.when_mentioned, intents=intents)
        self.statuses = itertools.cycle(STATUS_MESSAGES)

    async def setup_hook(self):
        await database.setup()
        for cog in ("cogs.orders", "cogs.tickets", "cogs.assistant", "cogs.welcome"):
            await self.load_extension(cog)

        # Buttons on messages posted before a restart keep working.
        from cogs.assistant import HumanView
        from cogs.orders import TrackView
        from cogs.tickets import ClosedTicketView, TicketActionView, TicketPanelView

        self.add_view(TicketPanelView())
        self.add_view(TicketActionView())
        self.add_view(ClosedTicketView())
        self.add_view(HumanView())
        self.add_view(TrackView())

        synced = await self.tree.sync()
        log.info("Synced %d slash commands", len(synced))

    async def on_ready(self):
        log.info("%s is online as %s in %d server(s). AI assistant: %s", BOT_NAME, self.user, len(self.guilds), "on" if ai.ENABLED else "off (no DEEPSEEK_API_KEY)")
        if not self.rotate_status.is_running():
            self.rotate_status.start()

    @tasks.loop(seconds=30)
    async def rotate_status(self):
        kind, text = next(self.statuses)
        await self.change_presence(activity=discord.Activity(type=ACTIVITY_TYPES[kind], name=text))


bot = Tracer()


@bot.tree.error
async def on_app_command_error(interaction: discord.Interaction, error: app_commands.AppCommandError):
    log.error("/%s failed", interaction.command.name if interaction.command else "?", exc_info=error)
    embed = embeds.no_permission() if isinstance(error, app_commands.CheckFailure) else embeds.error("Something went wrong on our side. Please try again, or open a ticket.")
    send = interaction.followup.send if interaction.response.is_done() else interaction.response.send_message
    try:
        await send(embed=embed, ephemeral=True)
    except discord.HTTPException:
        pass


if __name__ == "__main__":
    discord.utils.setup_logging(level=logging.INFO)
    if not BOT_TOKEN:
        sys.exit("BOT_TOKEN is missing. Copy .env.example to .env and add the token from the Discord Developer Portal.")
    bot.run(BOT_TOKEN, log_handler=None)
