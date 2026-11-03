# Content patches

Reviewed, one-off changes to store content that lives in the database. `npm run build` applies pending patches
(`scripts/predeploy.mjs`) before `next build` reads the database, and the server applies any it missed when it
starts. Each patch runs once per database, in one transaction, and is recorded in the `content_patches` table.

A file is `<id>.json` (the id must match the file name; files apply in name order):

```json
{
  "id": "2026-11-03-example",
  "description": "What this changes and why.",
  "operations": [
    {
      "op": "product.update",
      "slug": "tracecore-75t",
      "fields": { "tagline": { "from": "Old tagline", "to": "New tagline" } },
      "images": [{ "url": "/media/products/x.webp", "alt": { "from": "", "to": "Descriptive alt text" } }]
    },
    { "op": "category.update", "slug": "dma", "fields": { "intro": { "from": null, "to": "Markdown intro" } } },
    { "op": "settings.announcements.replace", "where_contains": "shipping", "find": "$250", "replace": "{{freeShippingThreshold}}" },
    { "op": "guide.insert", "slug": "what-is-a-pcie-dma-card" }
  ]
}
```

- **Never forced.** A field is written only when its current value equals `from` (whitespace-insensitive; lists and
  specs compared by content). SEO fields, `description`, `brand`, `mpn`, `gtin` and image alt text are also written
  when they are empty. Anything else is skipped and logged, so an edit made in the admin is never overwritten.
- **Fields.** Products: `name`, `tagline`, `summary`, `highlights`, `specs`, `in_the_box`, `seo_title`,
  `seo_description`, `description`, `brand`, `mpn`, `gtin`. Categories: `name`, `blurb`, `intro`, `seo_title`,
  `seo_description`.
- **Guides** come from `content/guides/<slug>.md`: a frontmatter block between `---` lines with one `key: <JSON value>`
  per line (`title`, `description`, `section`, `kind`, `seo_title`, `cover_url`, `cover_alt`, `related_products`,
  `reviewed_by`, `sort_order`), then the Markdown body without an H1. A guide whose slug exists is never overwritten.
- **Check before shipping:** `npx tsx scripts/check-content.ts` (excluded terms, literal amounts, broken links,
  frontmatter, patch validity).
