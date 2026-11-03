<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Store rules for code and content

- **Deploy order.** `npm run build` runs `node scripts/predeploy.mjs` first: it applies the migrations in `drizzle/`, then the pending content patches in `content/patches/`, because `next build` prerenders from the database and reads every column the code knows. Schema changes stay additive (new nullable columns or tables); never drop or rename a column the running site reads.
- **Content patches** (`content/patches/*.json`, format in `content/patches/README.md`, applier `src/lib/content-patches.mjs`) change database content once per database, in a transaction. Each field carries the value it expects to replace (`from`); a field an admin has changed since is skipped and logged, never forced. Guides arrive the same way (`guide.insert` from `content/guides/<slug>.md`) and are never overwritten. Check files with `npx tsx scripts/check-content.ts` before shipping.
- **Tokens, never typed amounts.** Shipping amounts and the support email come from Settings: `{{freeShippingThreshold}}`, `{{flatShipping}}`, `{{supportEmail}}`; guide prices are `{{price:<slug>}}` (`src/lib/tokens.ts`).
- **Content policy** (enforced by `src/lib/content-guard.ts` in admin saves, generators and the checker): the store sells hardware only. Never publish wording about cheats, anti-cheat systems, detection or bypassing it, spoofing or identity editing, firmware flashing, or control commands for input devices; never present a DMA card, a video fuser and an input device as one setup in copy, guides or related-product blocks. The website-only scope statement is `site.scopeStatement`; never write a broader claim.
- **SEO plumbing.** Page metadata goes through `pageMetadata()` (`src/lib/seo.ts`, self-canonical and complete Open Graph); structured data through the builders in `src/lib/jsonld.ts` rendered by `<JsonLd>`. Product, category, legal and guide pages render their content without Suspense so crawlers get it in the first response and unknown slugs return a real 404.
