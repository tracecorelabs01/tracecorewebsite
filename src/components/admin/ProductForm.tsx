"use client";

import { useId, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { ART_KEYS } from "@/lib/catalog/types";
import { centsToInput } from "@/lib/admin/format";
import { plainText } from "@/lib/markdown";
import { metaDescription } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { ActionForm, Field, FormStatus, Input, Select, SubmitButton, Textarea, Toggle, useActionForm, type ActionState } from "./forms";
import { ProductCosts, type ProductCostSetup } from "./ProductCosts";
import { SeoFields } from "./SeoFields";
import { TabPanel, Tabs, useActiveTab } from "./Tabs";
import { Card } from "./ui";

// The storefront's Markdown renderer, downloaded only when someone opens a preview.
const Markdown = dynamic(() => import("@/components/content/Markdown").then((m) => m.Markdown));

/**
 * A Markdown textarea with a live word count and a preview drawn by the storefront renderer (tokens such as
 * {{price:<slug>}} show as written). Used for product descriptions here and category intros on the categories page.
 */
export function MarkdownTextarea({ name, label, defaultValue, hint, minWords, rows = 14 }: { name: string; label: string; defaultValue?: string | null; hint?: string; minWords?: number; rows?: number }) {
  const id = useId();
  const { state } = useActionForm();
  const error = state?.fieldErrors?.[name];
  const [value, setValue] = useState(defaultValue ?? "");
  const [preview, setPreview] = useState(false);
  const words = plainText(value).split(" ").filter(Boolean).length;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
        <label htmlFor={id} className="font-medium text-muted">
          {label}
        </label>
        <span className="flex items-center gap-3">
          <span className={cn("tabular-nums", minWords && words < minWords ? "text-amber-400" : "text-dim")}>
            {words} word{words === 1 ? "" : "s"}
            {minWords ? ` / ${minWords}+` : ""}
          </span>
          <button type="button" onClick={() => setPreview((p) => !p)} className="text-muted underline-offset-4 hover:text-fg hover:underline">
            {preview ? "Edit" : "Preview"}
          </button>
        </span>
      </div>
      {/* Hidden, not removed, while previewing: the form still submits it. */}
      <Textarea id={id} name={name} value={value} onChange={(e) => setValue(e.target.value)} rows={rows} hidden={preview} className="font-mono text-[13px]" />
      {preview && <div className="min-h-24 rounded-xl border border-line bg-ink-950 p-5 text-sm leading-relaxed text-muted">{value.trim() ? <Markdown source={value} /> : <p className="text-dim">Nothing to preview yet.</p>}</div>}
      {error ? <span className="mt-1 block text-xs text-[#ff6b5e]">{error}</span> : hint ? <span className="mt-1 block text-xs text-dim">{hint}</span> : null}
    </div>
  );
}

type ProductRow = {
  name: string;
  slug: string;
  tagline: string;
  categoryId: number | null;
  status: "active" | "draft" | "archived";
  priceCents: number;
  compareAtCents: number | null;
  badge: string | null;
  featured: boolean;
  sortOrder: number;
  trackInventory: boolean;
  stockQty: number;
  lowStockThreshold: number;
  allowBackorder: boolean;
  summary: string | null;
  highlights: string[] | null;
  specs: { label: string; value: string }[] | null;
  inTheBox: string[] | null;
  optionName: string | null;
  optionValues: string[] | null;
  artKey: string | null;
  brand: string | null;
  mpn: string | null;
  gtin: string | null;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
};

const ART_LABELS: Record<string, string> = {
  "dma-35t": "DMA card · 35T",
  "dma-75t": "DMA card · 75T",
  "dma-100t": "DMA card · 100T (heatsink)",
  cable: "Cable",
  riser: "PCIe riser",
  thermal: "Thermal kit",
  bundle: "Bundle",
  placeholder: "Placeholder",
};

type ProductFormProps = {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  product?: ProductRow;
  categories: { id: number; name: string }[];
  costs: ProductCostSetup;
};

/** The product editor, a tab per part. `photos` (the image manager) is left out until the product has been saved. */
export function ProductForm({ photos, ...props }: ProductFormProps & { photos?: ReactNode }) {
  return (
    <Tabs
      tabs={[
        { id: "details", label: "Details" },
        { id: "costs", label: "Costs & profit" },
        ...(photos ? [{ id: "photos", label: "Photos" }] : []),
        { id: "content", label: "Page content" },
        { id: "stock", label: "Stock & options" },
        { id: "seo", label: "SEO & feeds" },
      ]}
    >
      {photos && <TabPanel id="photos">{photos}</TabPanel>}
      <ProductFields {...props} />
    </Tabs>
  );
}

function ProductFields({ action, product: p, categories, costs }: ProductFormProps) {
  // Kept in state for the profit preview on the Costs tab.
  const [price, setPrice] = useState(centsToInput(p?.priceCents));
  // Photos save on their own, so on that tab the form and its Save button step aside, keeping anything typed.
  const onPhotos = useActiveTab() === "photos";
  return (
    <div hidden={onPhotos}>
      <ActionForm action={action} className="grid gap-4 xl:grid-cols-3" showStatus={false}>
        <div className="min-w-0 xl:col-span-2">
          <TabPanel id="details" className="space-y-4">
            <Card title="Details">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" name="name" className="sm:col-span-2">
                  <Input name="name" defaultValue={p?.name} required maxLength={160} placeholder="TraceCore 75T" />
                </Field>
                <Field label="URL slug" name="slug" hint={p ? "Changing the slug creates a permanent redirect from the old URL." : "Leave blank to generate from the name."}>
                  <Input name="slug" defaultValue={p?.slug} placeholder="tracecore-75t" className="font-mono" />
                </Field>
                <Field label="Tagline" name="tagline">
                  <Input name="tagline" defaultValue={p?.tagline} maxLength={255} placeholder="The flagship DMA card" />
                </Field>
                <Field label="Summary" name="summary" className="sm:col-span-2" hint="Shown under the price on the product page.">
                  <Textarea name="summary" defaultValue={p?.summary ?? ""} rows={4} />
                </Field>
              </div>
            </Card>

            <Card title="Pricing">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Price (USD)" name="price">
                  <Input name="price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="279.00" required />
                </Field>
                <Field label="Compare-at price" name="compareAt" hint="Optional. Shows as a strikethrough “was” price.">
                  <Input name="compareAt" inputMode="decimal" defaultValue={centsToInput(p?.compareAtCents)} placeholder="319.00" />
                </Field>
              </div>
            </Card>
          </TabPanel>

          <TabPanel id="costs">
            <ProductCosts price={price} {...costs} />
          </TabPanel>

          <TabPanel id="content" className="space-y-4">
            <Card title="Product page content" description="One item per line.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Highlights" name="highlights">
                  <Textarea name="highlights" defaultValue={(p?.highlights ?? []).join("\n")} rows={6} placeholder={"Xilinx Artix-7 FPGA\nUSB-C 3.0 data link"} />
                </Field>
                <Field label="In the box" name="inTheBox">
                  <Textarea name="inTheBox" defaultValue={(p?.inTheBox ?? []).join("\n")} rows={6} placeholder={"TraceCore 75T card\nUSB-C cable (1 m)"} />
                </Field>
                <Field label="Tech specs" name="specs" className="sm:col-span-2" hint='Write each spec as "Label: Value".'>
                  <Textarea name="specs" defaultValue={(p?.specs ?? []).map((s) => `${s.label}: ${s.value}`).join("\n")} rows={6} placeholder={"FPGA: Xilinx Artix-7 XC7A75T\nWarranty: 3 months"} className="font-mono text-[13px]" />
                </Field>
              </div>
            </Card>

            <Card title="Long description" description="The main text of the product page, in Markdown: ## headings, lists, **bold** and [links](/guides/...).">
              <MarkdownTextarea
                name="description"
                label="Description"
                defaultValue={p?.description}
                minWords={300}
                hint="300 to 600 words: what it is, what it needs, compatibility as tested, setup links and common questions. Write prices as {{price:<product-slug>}}."
              />
            </Card>

            <Card title="Render" description="Used when the product has no photos.">
              <Field label="Artwork" name="artKey">
                <Select name="artKey" defaultValue={p?.artKey ?? "placeholder"}>
                  {ART_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {ART_LABELS[k] ?? k}
                    </option>
                  ))}
                </Select>
              </Field>
            </Card>
          </TabPanel>

          <TabPanel id="stock" className="space-y-4">
            <Card title="Inventory">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-4 sm:col-span-2">
                  <Toggle name="trackInventory" label="Track stock" description="Count units and stop selling at zero." defaultChecked={p?.trackInventory ?? true} />
                  <Toggle name="allowBackorder" label="Allow pre-orders" description="Keep selling when stock hits zero (shows “Pre-order”)." defaultChecked={p?.allowBackorder ?? false} />
                </div>
                <Field label="Units in stock" name="stockQty">
                  <Input name="stockQty" type="number" defaultValue={p?.stockQty ?? 0} />
                </Field>
                <Field label="Low-stock alert at" name="lowStockThreshold" hint="Shows “Low stock” at or below this.">
                  <Input name="lowStockThreshold" type="number" min={0} defaultValue={p?.lowStockThreshold ?? 5} />
                </Field>
              </div>
            </Card>

            <Card title="Options" description="E.g. Bracket: Full height / Low profile. Leave empty for no options.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Option name" name="optionName">
                  <Input name="optionName" defaultValue={p?.optionName ?? ""} placeholder="Bracket" />
                </Field>
                <Field label="Values (one per line)" name="optionValues">
                  <Textarea name="optionValues" defaultValue={(p?.optionValues ?? []).join("\n")} rows={3} placeholder={"Full height\nLow profile"} />
                </Field>
              </div>
            </Card>
          </TabPanel>

          <TabPanel id="seo" className="space-y-4">
            <Card title="Search engines">
              <SeoFields
                title={p?.seoTitle}
                description={p?.seoDescription}
                titleFallback={p?.name || "the product name"}
                // What the product page uses: the summary (or tagline) as one line, cut to fit.
                descriptionFallback={metaDescription(p?.summary || p?.tagline || "") || "the summary"}
                path={`/product/${p?.slug || "your-product"}`}
              />
            </Card>

            <Card title="Product identity" description="For search results and product feeds. For resold items, use the maker's brand and part number.">
              <div className="space-y-4">
                <Field label="Brand" name="brand">
                  <Input name="brand" defaultValue={p?.brand ?? ""} maxLength={80} />
                </Field>
                <Field label="MPN" name="mpn" hint="The maker's part number.">
                  <Input name="mpn" defaultValue={p?.mpn ?? ""} maxLength={80} className="font-mono" />
                </Field>
                <Field label="GTIN" name="gtin" hint="The barcode number (UPC or EAN): 8, 12, 13 or 14 digits. Leave blank if there is none.">
                  <Input name="gtin" defaultValue={p?.gtin ?? ""} inputMode="numeric" maxLength={20} className="font-mono" />
                </Field>
              </div>
            </Card>
          </TabPanel>
        </div>

        <div className="xl:sticky xl:top-24 xl:self-start">
          <Card title="Publishing">
            <div className="space-y-4">
              <Field label="Status" name="status">
                <Select name="status" defaultValue={p?.status ?? "draft"}>
                  <option value="active">Active — visible in the store</option>
                  <option value="draft">Draft — hidden</option>
                  <option value="archived">Archived — hidden</option>
                </Select>
              </Field>
              <Field label="Category" name="categoryId">
                <Select name="categoryId" defaultValue={p?.categoryId ?? ""}>
                  <option value="">Uncategorised</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Toggle name="featured" label="Featured" description="Show in the homepage lineup." defaultChecked={p?.featured ?? false} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Badge" name="badge" hint="E.g. New">
                  <Input name="badge" defaultValue={p?.badge ?? ""} maxLength={40} />
                </Field>
                <Field label="Sort order" name="sortOrder" hint="Lower first">
                  <Input name="sortOrder" type="number" defaultValue={p?.sortOrder ?? 0} />
                </Field>
              </div>
              <SubmitButton className="w-full" pendingText="Saving…">
                Save product
              </SubmitButton>
              <FormStatus className="mt-0" />
            </div>
          </Card>
        </div>
      </ActionForm>
    </div>
  );
}
