"""The AI assistant in Discord: the first answer in every new ticket, follow-ups until the team takes over, /ask
anywhere in the server, and /summary for staff. The answers themselves come from ai.py."""
import asyncio
import logging
import re
from datetime import datetime, timezone

import discord
from discord import app_commands, ui
from discord.ext import commands

import ai
import database
import embeds
from checks import is_support, is_support_member
from cogs.orders import grant_customer_role
from config import BOT_NAME, COLOR_SILVER

log = logging.getLogger("tracer.assistant")

REPLY_DELAY = 3  # seconds to wait for more messages, so a burst of messages gets one answer
HISTORY = 40  # recent ticket messages the assistant reads


class HumanView(ui.View):
    """Under every AI answer in a ticket: hands the ticket to the team and pings them."""

    def __init__(self):
        super().__init__(timeout=None)

    @ui.button(label="Talk to a human", emoji="\U0001f64b", style=discord.ButtonStyle.secondary, custom_id="ai_human")
    async def human_btn(self, interaction: discord.Interaction, _):
        ticket = await database.get_ticket(interaction.channel.id)
        if not ticket or ticket["status"] != "open":
            return await interaction.response.send_message(embed=embeds.error("This ticket isn't open."), ephemeral=True)
        if interaction.user.id != ticket["user_id"] and not await is_support(interaction):
            return await interaction.response.send_message(embed=embeds.no_permission(), ephemeral=True)
        if ticket["ai_off"]:
            return await interaction.response.send_message("The team already has this ticket and will reply here.", ephemeral=True)
        await database.update_ticket(interaction.channel.id, ai_off=1)
        config = await database.get_config(interaction.guild.id)
        staff = " ".join(role.mention for role in map(interaction.guild.get_role, config["support_role_ids"]) if role)
        await interaction.response.send_message(staff or None, embed=embeds.ai_handoff())


def _plain(text: str) -> str:
    """Discord timestamps as dates, for the model."""
    return re.sub(r"<t:(\d+)(?::\w)?>", lambda m: datetime.fromtimestamp(int(m[1]), timezone.utc).strftime("%d %B %Y"), text)


def _embed_text(embed: discord.Embed) -> str:
    parts = [embed.author.name, embed.title, embed.description, *(f"{f.name}: {f.value}" for f in embed.fields)]
    return _plain("\n".join(p for p in parts if p))


def _message_text(message: discord.Message) -> str:
    files = ", ".join(a.filename for a in message.attachments)
    return (message.content + (f" [attached: {files}]" if files else ""))[:1500]


class AssistantCog(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.locks: dict[int, asyncio.Lock] = {}  # one answer at a time per ticket
        self.latest: dict[int, int] = {}  # ticket channel -> the customer's newest message

    async def _read_ticket(self, channel: discord.TextChannel, ticket: dict) -> tuple[str, list[dict], str]:
        """The ticket as the model sees it: the bot's cards (ticket details, verified order, notes) as context, the
        conversation as turns, and the same conversation as a transcript for /summary. The opening cards are always
        read, plus the latest messages."""
        first = [m async for m in channel.history(limit=3, oldest_first=True)]
        seen = {m.id for m in first}
        recent = [m async for m in channel.history(limit=HISTORY) if m.id not in seen][::-1]
        cards, turns, transcript = [], [], []
        for m in first + recent:
            if m.author.id == self.bot.user.id:
                for e in m.embeds:
                    if embeds.is_ai_answer(e):
                        turns.append({"role": "assistant", "content": e.description or ""})
                        transcript.append(f"AI assistant: {e.description}")
                    else:
                        cards.append(_embed_text(e))
            elif not m.author.bot and (m.content or m.attachments):
                who = "Customer" if m.author.id == ticket["user_id"] else f"Team member {m.author.display_name}"
                text = _message_text(m)
                turns.append({"role": "user", "content": text if who == "Customer" else f"[{who}] {text}"})
                transcript.append(f"{who}: {text}")
        if not any(t["role"] == "user" for t in turns):
            turns.insert(0, {"role": "user", "content": "(I've just opened this ticket. My details are in the ticket card.)"})
        context = f"{embeds.ticket_name(ticket)}. Cards {BOT_NAME} posted in it (ticket details, order check, notes):\n\n" + "\n\n".join(cards)
        return context, turns, "\n".join(transcript)

    async def _answer_ticket(self, channel: discord.TextChannel, customer: discord.Member):
        async with self.locks.setdefault(channel.id, asyncio.Lock()):
            ticket = await database.get_ticket(channel.id)
            if not ticket or ticket["status"] != "open" or ticket["ai_off"]:
                return
            context, turns, _ = await self._read_ticket(channel, ticket)
            if turns[-1]["role"] == "assistant":
                return  # already answered
            async with channel.typing():
                try:
                    text = await ai.answer(turns, customer.id, in_ticket=True, ticket=context, on_order=lambda order: grant_customer_role(customer, order))
                except ai.Unavailable as err:
                    log.info("No AI answer in %s: %s", channel.id, err)  # the team was pinged when the ticket opened
                    return
            await channel.send(embed=embeds.ai_answer(text), view=HumanView())

    @commands.Cog.listener()
    async def on_ticket_open(self, channel: discord.TextChannel, customer: discord.Member):
        if ai.ENABLED:
            await self._answer_ticket(channel, customer)

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message):
        if not ai.ENABLED or message.author.bot or not message.guild:
            return
        ticket = await database.get_ticket(message.channel.id)
        if not ticket or ticket["status"] != "open" or ticket["ai_off"]:
            return
        if message.author.id != ticket["user_id"]:
            if await is_support_member(message.author):
                await database.update_ticket(message.channel.id, ai_off=1)  # the team has taken over
            return
        self.latest[message.channel.id] = message.id
        await asyncio.sleep(REPLY_DELAY)
        if self.latest.get(message.channel.id) == message.id:  # otherwise the customer's newer message gets the answer
            await self._answer_ticket(message.channel, message.author)

    @app_commands.command(name="ask", description="Ask the AI assistant about products, stock, shipping or your order")
    @app_commands.describe(question="Your question")
    @app_commands.guild_only()
    async def ask_cmd(self, interaction: discord.Interaction, question: app_commands.Range[str, 2, 500]):
        await interaction.response.defer(ephemeral=True, thinking=True)
        try:
            text = await ai.answer([{"role": "user", "content": question}], interaction.user.id, in_ticket=False,
                                   on_order=lambda order: grant_customer_role(interaction.user, order))
        except ai.Unavailable as err:
            return await interaction.followup.send(embed=embeds.error(str(err)), ephemeral=True)
        await interaction.followup.send(embed=embeds.ai_answer(text, in_ticket=False), ephemeral=True)

    @app_commands.command(name="summary", description="AI summary of this ticket (support team)")
    @app_commands.guild_only()
    async def summary_cmd(self, interaction: discord.Interaction):
        if not await is_support(interaction):
            return await interaction.response.send_message(embed=embeds.no_permission(), ephemeral=True)
        ticket = await database.get_ticket(interaction.channel.id)
        if not ticket:
            return await interaction.response.send_message(embed=embeds.error("This isn't a ticket channel."), ephemeral=True)
        await interaction.response.defer(ephemeral=True, thinking=True)
        context, _, transcript = await self._read_ticket(interaction.channel, ticket)
        try:
            text = await ai.summarize(transcript, interaction.user.id, ticket=context)
        except ai.Unavailable as err:
            return await interaction.followup.send(embed=embeds.error(str(err)), ephemeral=True)
        await interaction.followup.send(embed=embeds.note(f"Summary of {embeds.ticket_name(ticket)}", text, COLOR_SILVER), ephemeral=True)


async def setup(bot: commands.Bot):
    await bot.add_cog(AssistantCog(bot))
