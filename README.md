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
- **Uploads**: `STORAGE_DRIVER=local` stores product photos in `./storage/uploads` — fine on a VPS / Node server (keep that folder between deploys). On serverless hosts (Vercel, Netlify) use `STORAGE_DRIVER=s3` with any S3-compatible bucket (Cloudflare R2, AWS S3, Backblaze B2…); see `.env.example`.
- **Connections**: shared hosts limit MySQL connections per user — keep `DATABASE_POOL_SIZE` small (default 5).

---

## Lab Console (`/admin`)

| Section | What it does | Role |
| --- | --- | --- |
| Dashboard | 30-day revenue, orders, AOV, revenue chart, items needing attention, top products, low stock | staff |
| Orders | Filter/search, update status, mark paid, tracking numbers, internal notes, timeline, restock on cancel, CSV export | staff |
| Customers | Order history, lifetime spend, notes, CSV export | staff |
| Inventory | Quick stock counts and low-stock thresholds | staff |
| Reviews | Moderate submitted reviews, import genuine reviews from Trustpilot/Discord | staff (import: admin) |
| Messages | Support inbox from the contact form | staff |
| Subscribers | Newsletter list, CSV export | staff |
| Products | Create/edit products, photos (auto-converted to WebP), pricing, options, specs, stock, SEO | admin |
| Categories | Shop tabs and ordering | admin |
| Discounts | Percentage/fixed codes with limits and date windows | admin |
| Expenses | Record business spending; spend, revenue, profit and margin by period and category, 12-month view, CSV export | admin |
| Setup builder | The shop page configurator: bundle discount, every question and answer, product picks, fuser specs, add-ons | admin |
| Settings | Announcement bar, shipping thresholds, social links, stats, payment badges, order note | admin |
| Activity | Audit log of every change | admin |
| Staff | Add staff, roles, disable accounts, reset passwords | owner |

Roles: **owner** (everything) › **admin** (everything except staff) › **staff** (day-to-day operations).

### How orders work

Checkout validates every line against the database (prices, options, stock — never trusting the browser), applies discount codes, and creates the order inside a transaction with guarded stock decrements, so the last unit can't be sold twice. Orders arrive as **pending / unpaid**. Until a payment provider is connected, send payment instructions (the *order note* in Settings is shown after checkout and in the confirmation email) and mark orders paid in the admin.

**Next step — payments**: connect a provider (Stripe, PayPal, a crypto processor…) in `src/actions/store.ts → placeOrder` (create a payment session after the order is saved) plus a webhook route that marks the order paid.

### Email (optional)

Set `RESEND_API_KEY`, `EMAIL_FROM` and `ORDER_ALERT_EMAIL` to send order confirmations, shipping notifications and new-order alerts via [Resend](https://resend.com). Without them the store works and simply doesn't email.

### Security

- Passwords hashed with scrypt; sessions are random tokens stored hashed in `admin_sessions` (httpOnly, SameSite=Lax cookie, 14-day expiry).
- Login rate limiting per IP and per email; every Server Action re-checks the session and role.
- `src/proxy.ts` keeps signed-out visitors out of `/admin` and adds `noindex` / anti-framing headers.
- Every change is written to the activity log. CSV exports neutralise spreadsheet formulas.

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
- Connect payments and email.

## Next.js 16 notes

Cache Components and Partial Prefetching are on, so: dynamic `params` are read inside `<Suspense>`, request data (cookies, search params) sits behind Suspense boundaries, and admin pages set `export const instant = false`. Visited pages stay mounted but hidden (React `<Activity>`), so effects clean up. Read `node_modules/next/dist/docs/` before upgrading.
