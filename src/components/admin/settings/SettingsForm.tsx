"use client";

import type { ReactNode } from "react";
import type { StoreSettings } from "@/lib/settings-defaults";
import { ActionForm, Field, FormStatus, Input, Select, SubmitButton, Textarea, type ActionState } from "@/components/admin/forms";
import { Card } from "@/components/admin/ui";

const LINKS = [
  { key: "discord", label: "Discord invite", placeholder: "https://discord.gg/…" },
  { key: "x", label: "X", placeholder: "https://x.com/…" },
  { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@…" },
  { key: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@…" },
] as const;

/** Exactly four counters — the homepage grid is laid out for four. */
const STAT_ROWS = 4;

function DollarInput(props: { name: string; defaultValue: number }) {
  return (
    <span className="relative block">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-dim">$</span>
      <Input type="number" min={0} step={0.01} inputMode="decimal" className="pl-7 tabular-nums" {...props} />
    </span>
  );
}

export function SettingsForm({
  action,
  settings,
  lastSaved,
  aside,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  settings: StoreSettings;
  lastSaved: string | null;
  aside?: ReactNode;
}) {
  const stats = Array.from({ length: STAT_ROWS }, (_, i) => settings.stats[i] ?? { value: 0, suffix: "", label: "" });

  return (
    <ActionForm action={action} className="grid gap-4 xl:grid-cols-3" showStatus={false}>
      <div className="space-y-4 xl:col-span-2">
        <Card title="Announcement bar" description="Scrolls across the top of every page.">
          <Field label="Messages" name="announcements" hint="One per line, up to 8 (140 characters each). Leave empty to hide the bar.">
            <Textarea name="announcements" defaultValue={settings.announcements.join("\n")} rows={5} placeholder={"Free worldwide shipping on orders over $250\nEvery unit is tested in our lab before dispatch"} />
          </Field>
        </Card>

        <Card title="Shipping" description="Applied to the cart, product pages and checkout. Amounts in USD.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Free shipping from" name="freeShippingThreshold" hint="Orders with a subtotal at or above this ship free. Use 0 to always ship free.">
              <DollarInput name="freeShippingThreshold" defaultValue={settings.freeShippingThreshold} />
            </Field>
            <Field label="Flat shipping rate" name="flatShipping" hint="Charged on orders below the free-shipping amount.">
              <DollarInput name="flatShipping" defaultValue={settings.flatShipping} />
            </Field>
          </div>
        </Card>

        <Card title="Support & social links" description="Used in the header, footer, support page and checkout.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Support email" name="supportEmail" className="sm:col-span-2" hint="Shown on the support page as the email contact.">
              <Input name="supportEmail" type="email" defaultValue={settings.supportEmail} maxLength={191} placeholder="support@example.com" />
            </Field>
            {LINKS.map((l) => (
              <Field key={l.key} label={l.label} name={`links.${l.key}`}>
                <Input name={`links.${l.key}`} type="url" defaultValue={settings.links[l.key]} maxLength={300} placeholder={l.placeholder} />
              </Field>
            ))}
          </div>
        </Card>

        <Card title="Homepage stats" description="The four counters in the “Why TraceCoreLab” section. Use real, current numbers.">
          <div className="grid gap-3 md:grid-cols-2">
            {stats.map((s, i) => (
              <div key={i} className="grid grid-cols-3 gap-3 rounded-xl border border-line bg-ink-950/40 p-4">
                <p className="col-span-3 font-mono text-[10.5px] uppercase tracking-[0.16em] text-dim">Stat {i + 1}</p>
                <Field label="Label" name={`stats.${i}.label`} className="col-span-3">
                  <Input name={`stats.${i}.label`} defaultValue={s.label} maxLength={40} placeholder="Orders shipped" />
                </Field>
                <Field label="Number" name={`stats.${i}.value`}>
                  <Input name={`stats.${i}.value`} type="number" step="any" inputMode="decimal" defaultValue={s.value} className="tabular-nums" />
                </Field>
                <Field label="Suffix" name={`stats.${i}.suffix`}>
                  <Input name={`stats.${i}.suffix`} defaultValue={s.suffix} maxLength={8} placeholder="+" />
                </Field>
                <Field label="Decimals" name={`stats.${i}.decimals`}>
                  <Select name={`stats.${i}.decimals`} defaultValue={String(s.decimals ?? 0)}>
                    <option value="0">0</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                  </Select>
                </Field>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Payment methods" description="Shown as badges in the footer — list only what you accept.">
          <Field label="Methods" name="payments" hint="One per line, up to 10 (30 characters each).">
            <Textarea name="payments" defaultValue={settings.payments.join("\n")} rows={4} placeholder={"Visa\nMastercard\nPayPal"} />
          </Field>
        </Card>

        <Card title="Order note" description="Shown to customers right after checkout and included in their order confirmation email.">
          <Field label="Message" name="orderNote" hint="Explain what happens next, e.g. how and when to pay. Up to 600 characters.">
            <Textarea name="orderNote" defaultValue={settings.orderNote} rows={4} maxLength={600} />
          </Field>
          <Field
            label="Hold unpaid orders for (hours)"
            name="reservationHours"
            hint="An unpaid order keeps its stock reserved this long, then it's cancelled automatically and the stock goes back on sale. Use 0 to hold stock until you cancel the order yourself. Up to 720 (30 days)."
          >
            <Input name="reservationHours" type="number" min={0} max={720} step={1} inputMode="numeric" defaultValue={settings.reservationHours} className="tabular-nums" />
          </Field>
        </Card>

        <Card title="Setup Builder" description="Customers who check out with a DMA card, a video fuser and an input device get this discount automatically. A discount code replaces it.">
          <Field label="Setup discount (%)" name="setupDiscountPercent" hint="Use 0 to turn it off. Up to 50.">
            <Input name="setupDiscountPercent" type="number" min={0} max={50} step={1} inputMode="numeric" defaultValue={settings.setupDiscountPercent} className="tabular-nums" />
          </Field>
        </Card>
      </div>

      <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
        <Card title="Publish">
          <p className="text-sm text-muted">Saving updates the storefront straight away.</p>
          <SubmitButton className="mt-4 w-full" pendingText="Saving…">
            Save settings
          </SubmitButton>
          <FormStatus />
          <p className="mt-3 text-xs text-dim">{lastSaved ? `Last saved ${lastSaved}` : "Using the built-in defaults — not saved yet."}</p>
        </Card>
        {aside}
      </div>
    </ActionForm>
  );
}
