# TraceCoreLab Store

Animated storefront + store management backend ("Lab Console") for TraceCoreLab.

- **Storefront**: Next.js 16 (App Router, Cache Components), Tailwind CSS v4, Motion, Lenis, React Three Fiber.
- **Backend**: MySQL / MariaDB via Drizzle ORM, Server Actions, a staff admin at **`/admin`**.

Without a database the storefront runs on a built-in demo catalogue, so it always works. Set `DATABASE_URL` and everything — products, stock, orders, customers, reviews, settings — comes from MySQL.

---

## Quick start (local)

```bash
npm install
cp .env.example .env.local     # then fill in DATABASE_URL
npm run db:setup               # create tables + import the starter catalogue
npm run admin:create           # create your owner account (prompts for a password)
npm run dev                    # http://localhost:3000  ·  admin: http://localhost:3000/admin
```

### Local test database (Docker)

A throwaway MySQL 8.4 container was set up for development:

```bash
docker start tcl-mysql     # if it isn't running
docker stop tcl-mysql      # when you're done
docker rm -f tcl-mysql     # delete it (and its data)
```

`.env.local` currently points at it. Test login: `owner@tracecorelab.local` / `local-test-password` (local only — create a real account on your production database).

---

## Connecting your remote MySQL

1. **Create the database** on your host with `utf8mb4` (e.g. `CREATE DATABASE tracecorelab CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`) and a user with full rights on it.
2. **Allow remote connections** from the machine that runs the app (and from your computer while setting up). On Hostinger: *Databases → Remote MySQL*, add the IP (or `%` for any).
3. **Set the connection string** in `.env.local` and in your hosting provider's environment variables:
   ```
   DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/DATABASE
   ```
   URL-encode special characters in the password (`@` → `%40`, `#` → `%23`). Set `DATABASE_SSL=true` if your provider requires TLS.
4. **Create the tables + starter catalogue**: `npm run db:setup`.
   *No remote access from your computer?* Import `database/schema.sql` in phpMyAdmin instead, then create your account with `npm run admin:create -- --sql` and paste the printed `INSERT` into phpMyAdmin.
5. **Create your owner account**: `npm run admin:create`.

### Hosting notes

- **The build reads the database** (product pages are prerendered from the catalogue), so `DATABASE_URL` must be reachable at build time too.
- **Uploads**: product photos are stored in the database (`media` table) and served at `/media/...`, so they survive deploys on hosts that build each deploy into a fresh folder (Hostinger does). For a large catalogue, `STORAGE_DRIVER=s3` uses any S3-compatible bucket instead (Cloudflare R2, AWS S3, Backblaze B2…); see `.env.example`.
- **Connections**: shared hosts limit MySQL connections per user — keep `DATABASE_POOL_SIZE` small (default 5).

---

## Lab Console (`/admin`)

| Section | What it does | Role |
| --- | --- | --- |
| Dashboard | 30-day revenue, orders, AOV, revenue chart, items needing attention, top products, low stock | staff |
| Orders | Filter/search, update status, mark paid, tracking numbers, internal notes, timeline, restock on cancel, CSV export | staff |
| Customers | Order history, lifetime spend, notes, CSV export; add customers, open their accounts or sign them out everywhere (admin) | staff |
| Inventory | Quick stock counts and low-stock thresholds | staff |
| Reviews | Moderate submitted reviews, import genuine reviews from Trustpilot/Discord | staff (import: admin) |
| Messages | Support inbox from the contact form | staff |
| Subscribers | Newsletter list, CSV export | staff |
| Products | Create/edit products, photos (auto-converted to WebP), pricing, options, specs, stock, SEO | admin |
| Categories | Shop tabs and ordering | admin |
| Discounts | Percentage/fixed codes with limits and date windows | admin |
| Loyalty | Points per $1 on paid orders, offers customers redeem for single-use codes, recent activity (manual adjustments on each customer) | admin |
| Expenses | Record business spending; spend, revenue, profit and margin by period and category, 12-month view, CSV export | admin |
| Setup builder | The shop page configurator: bundle discount, every question and answer, product picks, fuser specs, add-ons | admin |
| Settings | Announcement bar, shipping thresholds, social links, stats, payment badges, order note | admin |
| Legal pages | Terms, refund & cancellation, shipping and privacy policies shown at `/legal/...` (Razorpay checks these). Until saved, drafts from `src/lib/legal.ts` are shown | admin |
| Activity | Audit log of every change | admin |
| Staff | Add staff, roles, disable accounts, reset passwords | owner |

Roles: **owner** (everything) › **admin** (everything except staff) › **staff** (day-to-day operations).

### How orders work

Checkout validates every line against the database (prices, options, stock — never trusting the browser), applies discount codes, and creates the order inside a transaction with guarded stock decrements, so the last unit can't be sold twice. Orders arrive as **pending / unpaid**. For PayPal and crypto, send payment instructions (the *order note* in Settings is shown after checkout and in the confirmation email) and mark orders paid in the admin.

### Card payments (Razorpay)

With `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` set, a card order opens Razorpay's checkout right after it's placed, in the order's currency (USD; International Payments must be enabled in Razorpay). The payment is confirmed two ways, whichever comes first: the checkout's signed response (`src/actions/payment.ts`) and the webhook at `/api/razorpay/webhook` (`RAZORPAY_WEBHOOK_SECRET`). Either one marks the order paid, moves it to processing, adds loyalty points and sends the confirmation emails. Customers who close the window can pay from the same screen; unpaid orders are released after the reservation time like any other. Refunds are made in the Razorpay dashboard: a full refund marks the order's payment refunded. Logic lives in `src/lib/razorpay.ts`.

Test keys (`rzp_test_…`) take test cards only; swap in the live keys and a live-mode webhook to go live.

### Customer accounts and loyalty

A customer gets an account (`/account`) when they ask for one: **Create an account and continue** at checkout, or signing in with Discord or Google. **Continue as guest** creates no account, even after payment; guests see their orders at `/track` with a code emailed to the address they ordered with (the order emails link there). There are no customer passwords: they sign in at `/account/login` with Discord, Google (each shown only once its `DISCORD_CLIENT_ID`/`DISCORD_CLIENT_SECRET` or `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` is set, with `https://tracecorelab.com/api/auth/<discord|google>/callback` as the redirect URI), or their email and a 6-digit code we email them, which works once, for 10 minutes. A Discord account linked this way, with **Connect Discord** on the account page, or in Discord itself (the bot's `/track`, with a code emailed to the address the orders were placed with; no account needed) lets `/track` list that customer's own orders. Requesting a new code cancels the old one; six wrong codes, or six code emails, within 15 minutes lock that email for 15 minutes. This needs email (below) set up. Admins can also add a customer, open an account for one who hasn't paid yet, or sign one out everywhere from **Customers**. An account shows every order placed with that email, loyalty points with their history, rewards to redeem, and reviews.

Accounts keep an address book (`customer_addresses`, `src/lib/address.ts`). The address of an order placed while signed in, or of the checkout that creates the account, is saved (the first one becomes the default; the same place is never saved twice; up to 20). Checkout offers saved addresses in a **Ship to** selector, default first, with **A new address** to type another. On **Details** (`/account/details`) customers edit their name and phone, and add, edit, remove or pick the default address. Checking out with an account's email without signing in adds nothing to that account.

Points are added when an order is marked paid (by default 100 per $1 of products after discounts; shipping doesn't earn) and taken back if it's refunded, cancelled or marked unpaid. Offers are set up under **Loyalty**; redeeming one spends the points and issues a single-use `PTS-` discount code. Reviews from accounts are verified buyers only and wait for approval in **Reviews**.

### Email (Resend)

Set `RESEND_API_KEY` (a sending-only key for your domain), `EMAIL_FROM` and `ORDER_ALERT_EMAIL`. Without them the store still takes orders, but sends no email and customers can't sign in to their accounts. Every email shares one themed layout (`src/lib/email.ts`) headed by the store logo (`public/brand/email-logo.png`, the site header's logo as a PNG at 4x, since email clients don't show SVG or web fonts), has a plain-text version, replies to `EMAIL_REPLY_TO` (or `ORDER_ALERT_EMAIL`), links to the Discord from Settings, and carries an idempotency key so a retry never sends it twice.

| Email | Sent when |
| --- | --- |
| Order received (with invoice, amount due) | A PayPal/crypto order is placed |
| Payment received + invoice | Razorpay confirms a card payment, or staff mark an order paid |
| Shipped (tracking number + "Track your package") | Staff mark an order shipped |
| Tracking update | Tracking changes on an order that's already shipped |
| Delivered (warranty dates, review link) | Staff mark an order delivered |
| Cancelled | Staff cancel an order, or an unpaid order's reservation runs out |
| Refunded | Staff mark it refunded, or a full refund is made in Razorpay |
| Sign-in code | A customer asks for one on `/account/login` |
| Welcome | Staff add a customer or open their account (customers' own accounts are announced in the payment email) |
| Staff: reset password link | "Forgot password" on `/admin/forgot`; links work once, for an hour |
| Staff: password changed | A staff password is reset |
| Reward code | A customer redeems points |
| Newsletter welcome | Someone signs up in the footer |
| Staff: new order, contact form message | To `ORDER_ALERT_EMAIL`; replying goes to the customer |

Order emails are templates in `src/lib/emails/orders.ts` and each send is noted on the order's timeline; account emails are in `src/lib/emails/account.ts`.

Newsletter campaigns: sign-ups are stored under **Subscribers**. Send campaigns as Resend broadcasts; import new subscribers into Resend first (Subscribers → Export CSV, then Resend → Contacts → Import).

### Security

- Staff passwords hashed with scrypt; sessions are random tokens stored hashed in `admin_sessions` (httpOnly, SameSite=Lax cookie, 14-day expiry). Customers have no passwords; their sign-in codes and sessions are stored hashed too.
- Login rate limiting per IP and per email; every Server Action re-checks the session and role.
- `src/proxy.ts` keeps signed-out visitors out of `/admin` and adds `noindex` / anti-framing headers.
- Every change is written to the activity log. CSV exports neutralise spreadsheet formulas.
- `overrides` in package.json pin patched versions of `esbuild` and `minimatch` (both only used by the dev tooling). minimatch 11 isn't callable the way the ESLint React/import/jsx-a11y plugins call minimatch 3, so their rules that take glob options (e.g. `react/jsx-pascal-case` with `allowedNames`) would throw if switched on; none are in this project's config.

---

## Scripts

| Script | |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run db:setup` | `db:migrate` + `db:seed` |
| `npm run db:migrate` | Apply SQL migrations in `/drizzle` to `DATABASE_URL` (the server also applies new ones when it starts) |
| `npm run db:seed` | Import starter categories/products/settings (skips anything that exists; never seeds reviews or orders) |
| `npm run db:generate` | After editing `src/db/schema.ts`, generate a new migration |
| `npm run db:sql` | Rebuild `database/schema.sql` for phpMyAdmin |
| `npm run admin:create` | Create or reset an admin (`--sql` prints an INSERT instead) |
| `npm run assets` | Rebuild recoloured media in `/public` |

## Where things live

| What | Where |
| --- | --- |
| Database schema | `src/db/schema.ts` → migrations in `/drizzle` |
| Storefront data (DB or demo fallback) | `src/lib/catalog/server.ts` |
| Checkout, newsletter, contact actions | `src/actions/store.ts` |
| Admin pages / actions / queries | `src/app/admin`, `src/actions/admin`, `src/lib/admin` |
| Default settings (before editing in admin) | `src/lib/site.ts`, `src/lib/settings-defaults.ts` |
| Demo catalogue (no database) | `src/data/products.ts` |
| Brand colours, fonts, keyframes | `src/app/globals.css` |

## Before launch

- Replace starter products, prices and specs (Products), and review Settings.
- Replace the sample reviews: in database mode only reviews you approve are shown — only publish genuine ones.
- Write real policies for `/legal/*` and review the FAQ (`src/data/faq.ts`).
- Switch Razorpay to live keys, and connect email.

## Next.js 16 notes

Cache Components and Partial Prefetching are on, so: dynamic `params` are read inside `<Suspense>`, request data (cookies, search params) sits behind Suspense boundaries, and admin pages set `export const instant = false`. Visited pages stay mounted but hidden (React `<Activity>`), so effects clean up. Read `node_modules/next/dist/docs/` before upgrading.
