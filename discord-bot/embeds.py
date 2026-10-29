"""Every message Tracer sends, in TraceCore Lab branding."""
from datetime import datetime

import discord

from config import BANNER_URL, BOT_NAME, BRAND, COLOR_AMBER, COLOR_BRAND, COLOR_EMBER, COLOR_OK, COLOR_SILVER, LOGO_URL, STORE_URL

FOOTER = f"{BOT_NAME} · {BRAND}"

# Ticket types as customers see them. "purchase" is the Orders ticket.
TICKET_KINDS = {
    "purchase": {"label": "Orders", "emoji": "\U0001f6d2", "blurb": "Questions about an order, payment or delivery", "color": COLOR_BRAND},
    "support": {"label": "Tech support", "emoji": "\U0001f6e0️", "blurb": "Setup help and troubleshooting", "color": COLOR_SILVER},
    "warranty": {"label": "Warranty", "emoji": "\U0001f6e1️", "blurb": "Repairs and replacements for faulty hardware", "color": COLOR_AMBER},
    "reseller": {"label": "Reseller", "emoji": "\U0001f91d", "blurb": "Bulk orders and reseller enquiries", "color": COLOR_OK},
}

ORDER_STATUS = {"pending": "Received", "processing": "Being prepared", "shipped": "Shipped", "delivered": "Delivered", "cancelled": "Cancelled", "refunded": "Refunded"}
PAYMENT_STATUS = {"unpaid": "Awaiting payment", "paid": "Paid", "refunded": "Refunded", "failed": "Payment failed"}


def kind(category: str) -> dict:
    return TICKET_KINDS.get(category, {"label": category.title(), "emoji": "", "blurb": "", "color": COLOR_BRAND})


def ticket_name(ticket: dict) -> str:
    return f"{kind(ticket.get('category', '')).get('label')} #{ticket.get('number', 0):04d}"


def base(description: str = "", color: int = COLOR_BRAND, author: str | None = None) -> discord.Embed:
    embed = discord.Embed(description=description, color=color)
    if author:
        embed.set_author(name=author)
    embed.set_footer(text=FOOTER, icon_url=LOGO_URL)
    return embed


def error(message: str) -> discord.Embed:
    return base(message, COLOR_EMBER, "Something's not right")


def no_permission() -> discord.Embed:
    return base("You don't have permission to use this.", COLOR_EMBER, "Not allowed")


def note(author: str, description: str, color: int = COLOR_BRAND) -> discord.Embed:
    return base(description, color, author)


# --- Store ---

def _when(value: str | None, style: str = "D") -> str | None:
    """ISO date from the website as a Discord timestamp, which shows in each reader's own time zone."""
    if not value:
        return None
    return f"<t:{int(datetime.fromisoformat(value.replace('Z', '+00:00')).timestamp())}:{style}>"


def _money(cents: int, currency: str) -> str:
    return f"${cents / 100:,.2f}" if currency == "USD" else f"{cents / 100:,.2f} {currency}"


def order(o: dict, staff: bool = False) -> discord.Embed:
    """An order from the website. Staff also see who it's for and a link to it in the admin."""
    color = {"delivered": COLOR_OK, "shipped": COLOR_AMBER, "cancelled": COLOR_EMBER, "refunded": COLOR_EMBER}.get(o["status"], COLOR_BRAND)
    embed = base(color=color, author=f"Order {o['number']}")
    if staff:
        embed.title = "Open in the admin"
        embed.url = o["adminUrl"]
    embed.add_field(name="Status", value=ORDER_STATUS.get(o["status"], o["status"].title()), inline=True)
    embed.add_field(name="Payment", value=PAYMENT_STATUS.get(o["paymentStatus"], o["paymentStatus"].title()), inline=True)
    embed.add_field(name="Total", value=_money(o["totalCents"], o["currency"]), inline=True)
    embed.add_field(name="Placed", value=_when(o["placedAt"]) or "Unknown", inline=True)
    if o.get("shippedAt"):
        embed.add_field(name="Shipped", value=_when(o["shippedAt"]), inline=True)
    if o.get("deliveredAt"):
        embed.add_field(name="Delivered", value=_when(o["deliveredAt"]), inline=True)

    lines = []
    for item in o["items"]:
        name = f"{item['qty']} × {item['name']}" + (f" ({item['option']})" if item.get("option") else "")
        until = item.get("warrantyUntil")
        lines.append(f"{name}\n*Warranty until {_when(until)}*" if until else name)
    embed.add_field(name="Items", value="\n".join(lines)[:1024] or "None", inline=False)
    if o["paymentStatus"] != "paid":
        embed.add_field(name="Warranty", value="Starts once the order is paid.", inline=False)

    tracking = o.get("tracking")
    if tracking:
        embed.add_field(name="Tracking", value=" · ".join(filter(None, [tracking.get("carrier"), tracking.get("number") and f"`{tracking['number']}`"])), inline=False)
    if o.get("points"):
        embed.add_field(name="Loyalty points", value=f"{o['points']:+,}", inline=True)
    if staff:
        c = o["customer"]
        embed.add_field(name="Customer", value=f"{c['name'] or 'No name'}\n{c['email']}\n{c['country']}", inline=True)
    return embed


def order_not_found(number: str, with_email: bool) -> discord.Embed:
    hint = "Check the order number and the email you ordered with, both are on your order confirmation." if with_email else "Check the order number."
    return base(f"We couldn't find order **{number}**. {hint}", COLOR_EMBER, "Order not found")


def payment() -> discord.Embed:
    embed = base(
        f"All orders are placed and paid on **[{STORE_URL.removeprefix('https://')}]({STORE_URL}/shop)**.\n\n"
        "**Card payments** (Visa, Mastercard) go through **Razorpay's** secure checkout, so we never see your card details. "
        "Your order is confirmed the moment the payment goes through, and you'll get an email with your order number.\n\n"
        "Questions about paying? Open an **Orders** ticket.",
        COLOR_BRAND,
        "How to pay",
    )
    embed.set_thumbnail(url=LOGO_URL)
    return embed


def help_menu(staff: bool) -> discord.Embed:
    embed = base(f"Here's what {BOT_NAME} can do.", COLOR_BRAND, f"{BOT_NAME} commands")
    embed.add_field(
        name="For everyone",
        value="\n".join([
            "`/track` `<order>` `<email>` · follow your order, tracking and warranty",
            "`/payment` · how to pay",
            "Open a ticket with the buttons in the support channel.",
        ]),
        inline=False,
    )
    if staff:
        embed.add_field(
            name="Tickets",
            value="\n".join([
                "`/order` `<order>` · look up any order (staff view)",
                "`/close`, `/reopen`, `/delete` · in a ticket",
                "`/add` `<user>`, `/remove` `<user>`, `/rename` `<name>`",
                "`/ticketstats` · open and closed counts",
            ]),
            inline=False,
        )
        embed.add_field(
            name="Admin",
            value="\n".join([
                "`/ticketpanel` · post the ticket buttons",
                "`/ticketautosetup` · create the role, log channel and categories",
                "`/ticketsetup` · pick them by hand",
                "`/removesupportrole` `<role>`, `/deletealltickets`",
                "`/addfund`, `/removefund`, `/walletinfo` · staff wallet (only you see it)",
            ]),
            inline=False,
        )
    return embed


# --- Tickets ---

def ticket_panel() -> discord.Embed:
    lines = [f"{k['emoji']} **{k['label']}** · {k['blurb']}" for k in TICKET_KINDS.values()]
    embed = base(
        f"Need a hand? Pick what it's about and a member of the {BRAND} team will join you in a private channel.\n\n"
        + "\n".join(lines)
        + "\n\n\U0001f4e6 **Track order** · see where your order is, no ticket needed",
        COLOR_BRAND,
        f"{BRAND} support",
    )
    embed.set_image(url=BANNER_URL)
    return embed


def ticket_welcome(user: discord.Member, category: str, number: int, description: str, order_number: str | None) -> discord.Embed:
    k = kind(category)
    embed = base(
        f"Thanks for reaching out, {user.mention}. Someone from the team will be with you shortly.\n\n**Details**\n{description or '*None given*'}",
        k["color"],
        f"{k['emoji']} {k['label']} ticket #{number:04d}",
    )
    if order_number:
        embed.add_field(name="Order", value=f"`{order_number}`", inline=True)
    embed.add_field(name="Status", value="Open", inline=True)
    embed.set_thumbnail(url=user.display_avatar.url)
    return embed


def ticket_closed(by: discord.abc.User) -> discord.Embed:
    return note("Ticket closed", f"Closed by {by.mention}. The channel is now read-only, and the team can reopen or delete it.", COLOR_EMBER)


def ticket_reopened(by: discord.abc.User) -> discord.Embed:
    return note("Ticket reopened", f"Reopened by {by.mention}.", COLOR_OK)


def ticket_claimed(by: discord.abc.User) -> discord.Embed:
    return note("Ticket claimed", f"{by.mention} is looking after this ticket.", COLOR_SILVER)


def transcript_log(ticket: dict, creator, closer, message_count: int) -> discord.Embed:
    embed = base(f"Transcript saved for **{ticket_name(ticket)}**.", COLOR_SILVER, "Ticket transcript")
    embed.add_field(name="Opened by", value=creator.mention if creator else f"`{ticket.get('user_id')}`", inline=True)
    embed.add_field(name="Closed by", value=closer.mention if closer else f"`{ticket.get('closed_by') or 'n/a'}`", inline=True)
    embed.add_field(name="Messages", value=str(message_count), inline=True)
    if ticket.get("order_number"):
        embed.add_field(name="Order", value=f"`{ticket['order_number']}`", inline=True)
    embed.add_field(name="Opened", value=ticket.get("created_at") or "Unknown", inline=True)
    embed.add_field(name="Closed", value=ticket.get("closed_at") or "Unknown", inline=True)
    return embed


def ticket_dm(ticket: dict) -> discord.Embed:
    return note(
        f"{BRAND} · ticket closed",
        f"Your ticket **{ticket_name(ticket)}** has been closed. The transcript is attached for your records.\n\nThanks for being a {BRAND} customer.",
    )


def ticket_stats(guild_name: str, tickets: list[dict]) -> discord.Embed:
    open_count = sum(t["status"] == "open" for t in tickets)
    embed = base(f"Tickets in **{guild_name}**", COLOR_BRAND, "Ticket stats")
    embed.add_field(name="All time", value=str(len(tickets)), inline=True)
    embed.add_field(name="Open", value=str(open_count), inline=True)
    embed.add_field(name="Closed", value=str(len(tickets) - open_count), inline=True)
    by_kind = []
    for key, k in TICKET_KINDS.items():
        mine = [t for t in tickets if t["category"] == key]
        if mine:
            by_kind.append(f"{k['emoji']} **{k['label']}** · {sum(t['status'] == 'open' for t in mine)} open / {len(mine)} total")
    if by_kind:
        embed.add_field(name="By type", value="\n".join(by_kind), inline=False)
    return embed


def setup_summary(log_channel, categories: dict, role_ids: list[int], heading: str = "Ticket setup saved") -> discord.Embed:
    lines = [f"**Transcripts:** {log_channel.mention if log_channel else '*not set*'}"]
    for key, k in TICKET_KINDS.items():
        cat = categories.get(key)
        lines.append(f"**{k['label']} category:** {cat.name if cat else '*not set*'}")
    lines.append(f"**Support roles:** {', '.join(f'<@&{r}>' for r in role_ids) or '*none*'}")
    return note(heading, "\n".join(lines), COLOR_OK)


# --- Staff wallet ---

def fund_change(admin: discord.abc.User, amount: float, note_text: str, balance: float, added: bool) -> discord.Embed:
    embed = base(f"**{'+' if added else '-'}${amount:,.2f}** {'added to' if added else 'taken from'} the wallet", COLOR_OK if added else COLOR_EMBER, "Funds added" if added else "Funds removed")
    embed.add_field(name="New balance", value=f"**${balance:,.2f}**", inline=True)
    if note_text:
        embed.add_field(name="Note", value=note_text, inline=False)
    embed.set_footer(text=f"By {admin.display_name} · {FOOTER}", icon_url=admin.display_avatar.url)
    return embed


def wallet(balance: float, history: list[dict], total: int) -> discord.Embed:
    embed = base(color=COLOR_BRAND, author="Staff wallet")
    embed.add_field(name="Balance", value=f"**${balance:,.2f}**", inline=False)
    if history:
        lines = [
            f"`{'+' if tx['type'] == 'add' else '-'}${tx['amount']:,.2f}`" + (f" · *{tx['note']}*" if tx.get("note") else "") + (f" · <@{tx['by']}>" if tx.get("by") else "") + f" · {tx['date']}"
            for tx in history
        ]
        prefix = f"*Latest {len(history)} of {total}*\n" if total > len(history) else ""
        embed.add_field(name="Recent changes", value=(prefix + "\n".join(lines))[:1024], inline=False)
    else:
        embed.add_field(name="Recent changes", value="*Nothing yet*", inline=False)
    return embed
