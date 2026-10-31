# Tracer · TraceCore Lab Discord bot

Support tickets for the TraceCore Lab Discord, with an AI assistant and order tracking straight from tracecorelab.com.
The full guide for the team (what everything does and how it works) is the "Tracer and customer accounts" doc; this file covers setup.

## What it does

| | |
| --- | --- |
| **Ticket panel** (`/ticketpanel`) | Buttons for **Orders**, **Tech support**, **Warranty** and **Reseller** tickets, plus **Track order** and a link to the shop. Each ticket is a private channel for the customer and the support team. |
| **Order details in tickets** | Orders and warranty tickets ask for the order number and email. Tracer checks them against the website and posts the order (status, items, tracking, warranty dates) in the ticket. |
| **`/track`** | A customer's own orders, privately: a menu of them, and picking one shows its status, items, tracking and warranty dates. The first time, they link their Discord to their orders with **Link with my email** (a 6-digit code emailed to them, typed in Discord), or by signing in to the website with Discord. **Track one order** looks one up by its number and email instead. The bot only ever asks for the orders of whoever is using it. The ticket panel, `/intro` and the welcome message have a **Track my orders** button that does the same. |
| **`/order`** | Staff look up any order, with the customer's details and a link to it in the admin. |
| **`/intro`** | Admins post an introduction to the bot (what it does, the commands) in a channel. |
| **`/payment`** | How to pay: on the website, by card through Razorpay. |
| **Transcripts** | Closing a ticket DMs the customer an HTML transcript; deleting saves one to the log channel. Records are kept, so `/ticketstats` keeps its history. |
| **AI assistant** | Answers in new tickets straight away and keeps helping until the team writes, presses Claim or the customer presses **Talk to a human**. `/ask` answers anyone privately; `/summary` sums up a ticket for staff. Runs on DeepSeek, answers only from the website's live products, prices, stock, shipping, payment and FAQ (`ai.py`, `cogs/assistant.py`). |
| **Customer role** | Given automatically when someone verifies a paid order (order number + its email). |
| **Idle tickets** | Waiting on the customer for a day: a reminder. Another day: closed, transcript sent. |
| **`/help`** | Customers see their commands; staff see everything. |

New paid orders are announced in a staff channel by the **website** (a Discord webhook), so that works even if the bot is offline. See "Connect the website" below.

Warranty dates follow the FAQ: 3 months on everything, counted from the purchase date (`src/lib/warranty.ts` on the website). Defective or damaged items are replaced, not refunded.

## 1. Discord Developer Portal

1. **Reset the token.** The old bot's token was shared in a zip, so treat it as public: Bot → **Reset Token**. Put the new one only in `/etc/tracer.env` on the droplet (section 3).
2. **Rename and rebrand:** General Information → name **Tracer**; App Icon `brand/pfp.png`. Bot → username **Tracer**, avatar `brand/pfp.png`, banner `brand/pfpbanner.png`.
3. Bot → turn on **Server Members Intent** and **Message Content Intent** (needed for staff lookups and transcripts).
4. Invite link (OAuth2 → URL Generator): scopes `bot` and `applications.commands`; permissions Manage Roles, Manage Channels, View Channels, Send Messages, Manage Messages, Embed Links, Attach Files, Read Message History.

To use a different name later, change `BOT_NAME` in `config.py` and the name in the portal.

## 2. Connect the website

On the website's hosting (Hostinger → environment variables), then redeploy:

| Variable | Value |
| --- | --- |
| `BOT_API_KEY` | A long random secret. The bot gets the same value as `STORE_API_KEY`. Generate one with `python3 -c "import secrets; print(secrets.token_urlsafe(32))"`. |
| `DISCORD_ORDER_WEBHOOK_URL` | Discord → your staff channel → Edit Channel → Integrations → Webhooks → New Webhook → Copy URL. Paid orders are posted there. |

## 3. Run it on the droplet

Tracer runs on the DigitalOcean droplet (Ubuntu 24.04) as a systemd service named `tracer`, which starts it on boot and restarts it if it crashes. It needs no domain or open port: the bot only connects out to Discord and the website. Run it in one place only: two copies with the same token would both answer.

Set up once, as root (`ssh root@<droplet IP>`, or the droplet's **Web Console**):

```bash
apt-get update && apt-get install -y python3-venv git
useradd --system --shell /usr/sbin/nologin tracer
git clone --filter=blob:none --sparse https://github.com/tracecorelabs01/tracecorewebsite.git /opt/tracecore
cd /opt/tracecore && git sparse-checkout set discord-bot && cd discord-bot
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
install -d -o tracer -g tracer data
install -m 600 .env.example /etc/tracer.env && nano /etc/tracer.env   # BOT_TOKEN, ADMIN_IDS, STORE_API_KEY, DEEPSEEK_API_KEY
cp tracer.service tracer-update.service tracer-update.timer /etc/systemd/system/ && systemctl daemon-reload
systemctl enable --now tracer tracer-update.timer
```

| | |
| --- | --- |
| **Logs** | `journalctl -u tracer -f` ("Tracer is online" once it's connected) |
| **Restart / stop** | `systemctl restart tracer` / `systemctl stop tracer` |
| **Settings** | Edit `/etc/tracer.env` (only root can read it), then restart. |
| **Updating** | Automatic: `tracer-update.timer` checks GitHub every 5 minutes and, when `discord-bot/` changed, pulls it, installs packages and restarts the bot (a version that doesn't compile is skipped). Log: `journalctl -u tracer-update`. To update now: `sh /opt/tracecore/discord-bot/update.sh`. |
| **Database** | `/opt/tracecore/discord-bot/data/bot.db`. Back it up now and then, or turn on the droplet's backups in DigitalOcean. |

## 4. In the Discord server

1. `/ticketautosetup` creates the **Support Team** role, a private **#ticket-logs** channel and the four ticket categories. (Or pick your own with `/ticketsetup`.)
2. Give your staff the Support Team role.
3. In your support channel, run `/ticketpanel`. Delete any panel posted by the old bot, since it doesn't have the new buttons.
4. Optionally run `/payment` in an info channel.

## Files

| File | |
| --- | --- |
| `bot.py` | Start-up, status messages, error handling |
| `config.py` | Name, colours, status lines; secrets come from the environment (`/etc/tracer.env` on the droplet, or a local `.env`) |
| `cogs/tickets.py` | Ticket panel, ticket channels, close/reopen/delete, transcripts, setup commands |
| `cogs/orders.py` | `/track`, `/order`, `/payment`, `/help`, the Customer role |
| `cogs/assistant.py` | The AI assistant in Discord: ticket answers, `/ask`, `/summary`, Talk to a human |
| `ai.py` | The AI assistant's rules, the live store data, DeepSeek calls, order lookups, limits |
| `store.py` | Talks to the website's bot API (orders, live store data) |
| `embeds.py` | Every message's look |
| `transcript.py` | HTML transcripts |
| `database.py` | SQLite storage |
| `tracer.service` | How the droplet runs it (systemd) |
| `update.sh`, `tracer-update.*` | Automatic updates from GitHub every 5 minutes |
