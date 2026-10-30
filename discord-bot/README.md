# Tracer · TraceCore Lab Discord bot

Support tickets for the TraceCore Lab Discord, with order tracking straight from tracecorelab.com.

## What it does

| | |
| --- | --- |
| **Ticket panel** (`/ticketpanel`) | Buttons for **Orders**, **Tech support**, **Warranty** and **Reseller** tickets, plus **Track order** and a link to the shop. Each ticket is a private channel for the customer and the support team. |
| **Order details in tickets** | Orders and warranty tickets ask for the order number and email. Tracer checks them against the website and posts the order (status, items, tracking, warranty dates) in the ticket. |
| **`/track`** | Customers follow their order privately: status, tracking number and warranty end date. Needs the order number and the email it was placed with. |
| **`/order`** | Staff look up any order, with the customer's details and a link to it in the admin. |
| **`/payment`** | How to pay: on the website, by card through Razorpay. |
| **Transcripts** | Closing a ticket DMs the customer an HTML transcript; deleting saves one to the log channel. Records are kept, so `/ticketstats` keeps its history. |
| **Staff wallet** | `/addfund`, `/removefund`, `/walletinfo`: a shared balance with notes, visible only to the admin using it. |
| **`/help`** | Customers see their commands; staff see everything. |

New paid orders are announced in a staff channel by the **website** (a Discord webhook), so that works even if the bot is offline. See "Connect the website" below.

Warranty dates follow the FAQ: 12 months on all hardware, 24 on the 100T Pro, counted from delivery (`src/lib/warranty.ts` on the website).

## 1. Discord Developer Portal

1. **Reset the token.** The old bot's token was shared in a zip, so treat it as public: Bot → **Reset Token**. Put the new one only in Dokploy (section 3).
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

## 3. Run it on the VPS with Dokploy

All in Dokploy's dashboard. Dokploy builds the bot from GitHub with `Dockerfile`, restarts it if it crashes, and redeploys it when its code changes.

1. **Connect GitHub (once):** **Git** → GitHub → **Create Github App**, then **Install** it on the `tracecorewebsite` repository.
2. **Create the app:** open a project → **Create Service** → **Application**, named `tracer`.
3. **General → Provider → GitHub:** Repository `tracecorewebsite`, Branch `main`, Build Path `/discord-bot`, Watch Paths `discord-bot/**` (so website changes don't restart the bot). **Save**.
4. **General → Build Type → Dockerfile:** Dockerfile Path `Dockerfile`, Docker Context Path left empty. **Save**.
5. **Environment:** the variables from `.env.example` with your values: `BOT_TOKEN`, `ADMIN_IDS`, `STORE_URL`, `STORE_API_KEY`. **Save**.
6. **Advanced → Volumes → Add Volume → Volume Mount:** Volume Name `tracer-data`, Mount Path `/app/data`. This keeps tickets, ticket stats and the staff wallet between deploys.
7. **Advanced → Swarm Settings → Update Config:** Parallelism `1`, Order **Stop First**, then **Save Update Config**. The bot must only run once, and Dokploy's default starts the new copy before stopping the old one.
8. **General → Deploy.** The **Logs** tab shows "Tracer is online" when it's connected.

It needs no domain or port: the bot only connects out to Discord and the website.

**Updating:** pushing changes in `discord-bot/` to `main` redeploys it, or press **Deploy**.

The database is `bot.db` in the `tracer-data` volume. Back it up now and then (the app's **Volume Backups** tab can do it on a schedule).

## 4. In the Discord server

1. `/ticketautosetup` creates the **Support Team** role, a private **#ticket-logs** channel and the four ticket categories. (Or pick your own with `/ticketsetup`.)
2. Give your staff the Support Team role.
3. In your support channel, run `/ticketpanel`. Delete any panel posted by the old bot, since it doesn't have the new buttons.
4. Optionally run `/payment` in an info channel.

## Files

| File | |
| --- | --- |
| `bot.py` | Start-up, status messages, error handling |
| `config.py` | Name, colours, status lines; secrets come from the environment (Dokploy, or a local `.env`) |
| `cogs/tickets.py` | Ticket panel, ticket channels, close/reopen/delete, transcripts, setup commands |
| `cogs/orders.py` | `/track`, `/order`, `/payment`, `/help` |
| `cogs/wallet.py` | Staff wallet |
| `store.py` | Talks to the website's order API |
| `embeds.py` | Every message's look |
| `transcript.py` | HTML transcripts |
| `database.py` | SQLite storage |
| `Dockerfile` | How Dokploy builds and runs it |
