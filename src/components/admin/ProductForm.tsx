"use client";

import { ART_KEYS } from "@/lib/catalog/types";
import { centsToInput } from "@/lib/admin/format";
import { ActionForm, Field, FormStatus, Input, Select, SubmitButton, Textarea, Toggle, type ActionState } from "./forms";
import { Card } from "./ui";

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

export function ProductForm({
  action,
  product,
  categories,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  product?: ProductRow;
  categories: { id: number; name: string }[];
}) {
  const p = product;
  return (
    <ActionForm action={action} className="grid gap-4 xl:grid-cols-3" showStatus={false}>
      <div className="space-y-4 xl:col-span-2">
        <Card title="Details">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" name="name" className="sm:col-span-2">
              <Input name="name" defaultValue={p?.name} required maxLength={160} placeholder="TraceCore 75T" />
            </Field>
            <Field label="URL slug" name="slug" hint="Leave blank to generate from the name.">
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
              <Input name="price" inputMode="decimal" defaultValue={centsToInput(p?.priceCents)} placeholder="279.00" required />
            </Field>
            <Field label="Compare-at price" name="compareAt" hint="Optional. Shows as a strikethrough “was” price.">
              <Input name="compareAt" inputMode="decimal" defaultValue={centsToInput(p?.compareAtCents)} placeholder="319.00" />
            </Field>
          </div>
        </Card>

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
      </div>

      <div className="space-y-4">
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

        <Card title="Search engines">
          <div className="space-y-4">
            <Field label="SEO title" name="seoTitle" hint="Defaults to the product name.">
              <Input name="seoTitle" defaultValue={p?.seoTitle ?? ""} maxLength={160} />
            </Field>
            <Field label="SEO description" name="seoDescription" hint="Defaults to the summary.">
              <Textarea name="seoDescription" defaultValue={p?.seoDescription ?? ""} rows={3} maxLength={320} />
            </Field>
          </div>
        </Card>
      </div>
    </ActionForm>
  );
}
