"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Check, ChevronDown, Plus, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { ActionForm, Field, FormStatus, Input, Select, SubmitButton, Textarea, Toggle, useActionForm, type ActionState } from "@/components/admin/forms";
import { Card, buttonClass } from "@/components/admin/ui";
import { SetupBuilder } from "@/components/build/SetupBuilder";
import { StoreSettingsProvider } from "@/components/layout/StoreSettings";
import type { BuilderProduct } from "@/lib/admin/setup-builder";
import type { Product } from "@/lib/catalog/types";
import type { StoreSettings } from "@/lib/settings-defaults";
import { STEP_ORDER, defaultSetupBuilder, fill, normalizeSetupBuilder, type BuilderFuser, type Heading, type SetupBuilderConfig, type StepCopy } from "@/lib/setup-builder";
import { cn, formatPrice } from "@/lib/utils";

type Config = SetupBuilderConfig;
type Section = "intro" | "budget" | "monitor" | "pc" | "input" | "summary";
type Tab = Section | "preview";

const TABS: { key: Tab; label: string }[] = [
  { key: "intro", label: "Discount & intro" },
  { key: "budget", label: "Budget" },
  { key: "monitor", label: "Monitor" },
  { key: "pc", label: "Second PC" },
  { key: "input", label: "Input device" },
  { key: "summary", label: "Summary" },
  { key: "preview", label: "Preview" },
];

/** The tab that holds a form field ("budget.tiers.0.card" → budget). */
function tabOf(field: string): Tab {
  const top = field.split(".")[0];
  return top === "budget" || top === "monitor" || top === "pc" || top === "input" || top === "summary" ? top : "intro";
}

const newId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
// An emptied number box is NaN (sent as null), so saving asks for a number instead of quietly using 0.
const toNumber = (v: string) => (v.trim() === "" ? NaN : Number(v));
const shown = (n: number) => (Number.isFinite(n) ? n : "");

interface Props {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  config: Config;
  percent: number;
  products: BuilderProduct[];
  categories: { slug: string; name: string }[];
  /** Live storefront products, for the preview. */
  catalog: Product[];
  settings: StoreSettings;
  lastSaved: string | null;
}

export function SetupBuilderEditor({ action, ...props }: Props) {
  return (
    <ActionForm action={action} showStatus={false}>
      <Editor {...props} />
    </ActionForm>
  );
}

function Editor({ config, percent: savedPercent, products, categories, catalog, settings, lastSaved }: Omit<Props, "action">) {
  const { state } = useActionForm();
  const [saved, setSaved] = useState({ config, percent: savedPercent });
  const [draft, setDraft] = useState(config);
  const [percent, setPercent] = useState(savedPercent);
  const [tab, setTab] = useState<Tab>("intro");
  const [handled, setHandled] = useState(state);
  const errors = state?.ok === false ? (state.fieldErrors ?? {}) : {};
  const dirty = percent !== saved.percent || JSON.stringify(draft) !== JSON.stringify(saved.config);

  // A save just finished: on success the draft becomes the saved version, otherwise open the first tab with a problem.
  if (state !== handled) {
    setHandled(state);
    if (state?.ok) {
      const clean = normalizeSetupBuilder(draft);
      setDraft(clean);
      setSaved({ config: clean, percent });
    } else {
      const first = Object.keys(state?.fieldErrors ?? {})[0];
      if (first) setTab(tabOf(first));
    }
  }

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const patch =
    <K extends Section>(key: K) =>
    (p: Partial<Config[K]>) =>
      setDraft((d) => ({ ...d, [key]: { ...d[key], ...p } }));
  const errorsIn = (t: Tab) => Object.keys(errors).filter((f) => tabOf(f) === t).length;
  const steps = STEP_ORDER.filter((k) => k === "budget" || k === "summary" || draft[k].enabled);
  const ctx = { products, open: errorsIn(tab) > 0 };

  return (
    <div className="space-y-4">
      <input type="hidden" name="data" value={JSON.stringify({ config: draft, percent })} />

      <div className="sticky top-16 z-20 -mx-4 border-b border-line bg-ink-950/90 px-4 py-3 backdrop-blur-xl md:-mx-8 md:px-8">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div role="tablist" aria-label="Setup builder sections" className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl border border-line bg-ink-900/70 p-1">
            {TABS.map((t) => {
              const n = errorsIn(t.key);
              const at = t.key === "intro" || t.key === "preview" ? -2 : steps.indexOf(t.key);
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className={cn("flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors", tab === t.key ? "bg-white/[0.08] text-fg" : "text-muted hover:text-fg")}
                >
                  {at >= 0 && <span className="font-mono text-[11px] text-amber">{at + 1}</span>}
                  {t.label}
                  {at === -1 && <span className="rounded bg-white/[0.06] px-1.5 font-mono text-[10px] uppercase tracking-wider text-dim">Off</span>}
                  {n > 0 && (
                    <span className="grid size-4 place-items-center rounded-full bg-ember font-mono text-[10px] text-white" aria-label={`${n} to fix`}>
                      {n}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("mr-1 text-xs", dirty ? "text-amber" : "text-dim")}>{dirty ? "Unsaved changes" : lastSaved && !state?.ok ? `Last saved ${lastSaved}` : state?.ok ? "All changes saved" : "Using the original builder"}</span>
            {dirty && (
              <button
                type="button"
                className={buttonClass("ghost")}
                onClick={() => {
                  setDraft(saved.config);
                  setPercent(saved.percent);
                }}
              >
                <Undo2 className="size-4" /> Discard
              </button>
            )}
            <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
          </div>
        </div>
        <FormStatus className="mt-2" />
      </div>

      <div role="tabpanel" aria-label={TABS.find((t) => t.key === tab)?.label} className="space-y-4">
        {tab === "intro" && (
          <IntroPanel value={draft} onChange={patch("intro")} onCategories={(discountCategories) => setDraft((d) => ({ ...d, discountCategories }))} percent={percent} onPercent={setPercent} categories={categories} questions={steps.length - 1} {...ctx} />
        )}
        {tab === "budget" && <BudgetPanel value={draft.budget} onChange={patch("budget")} inputStep={draft.input} {...ctx} />}
        {tab === "monitor" && <MonitorPanel value={draft.monitor} onChange={patch("monitor")} {...ctx} />}
        {tab === "pc" && <PcPanel value={draft.pc} onChange={patch("pc")} {...ctx} />}
        {tab === "input" && <InputPanel value={draft.input} onChange={patch("input")} {...ctx} />}
        {tab === "summary" && <SummaryPanel value={draft.summary} onChange={patch("summary")} percent={percent} {...ctx} />}
        {tab === "preview" && (
          <Card title="Preview" description="The builder as customers will see it, with your unsaved changes. Products that aren't published show as unavailable, just like on the store. Adding to the cart is turned off here.">
            <StoreSettingsProvider value={{ ...settings, setupDiscountPercent: Number.isFinite(percent) ? percent : 0 }}>
              <div className="-mx-5 -mb-5 pt-2 [&>section]:pb-8">
                <SetupBuilder config={normalizeSetupBuilder(draft)} products={catalog} preview />
              </div>
            </StoreSettingsProvider>
          </Card>
        )}
      </div>

      {tab !== "preview" && (
        <div className="flex justify-end pt-2">
          <button
            type="button"
            className={buttonClass("ghost", "sm")}
            onClick={() => {
              if (window.confirm("Put every question, product and text back to the original builder? Nothing changes on the store until you save.")) setDraft(defaultSetupBuilder);
            }}
          >
            <RotateCcw className="size-3.5" /> Start again from the original builder
          </button>
        </div>
      )}
    </div>
  );
}

/* ───────────── tabs ───────────── */

type Ctx = { products: BuilderProduct[]; open: boolean };
type PanelProps<K extends Section> = Ctx & { value: Config[K]; onChange: (p: Partial<Config[K]>) => void };

function IntroPanel({
  value: c,
  onChange,
  onCategories,
  percent,
  onPercent,
  categories,
  questions,
  products,
}: Ctx & {
  value: Config;
  onChange: (p: Partial<Config["intro"]>) => void;
  onCategories: (slugs: string[]) => void;
  percent: number;
  onPercent: (n: number) => void;
  categories: { slug: string; name: string }[];
  questions: number;
}) {
  const chosen = c.discountCategories;
  // Ticked categories that were deleted since, so they can still be unticked.
  const chips = [...categories, ...chosen.filter((s) => !categories.some((x) => x.slug === s)).map((s) => ({ slug: s, name: `${s} (deleted)` }))];
  const missing = percent > 0 ? unreachableCategories(c, products).map((s) => chips.find((x) => x.slug === s)?.name ?? s) : [];

  return (
    <>
      <Card title="Bundle discount" description="Taken off automatically at checkout when the cart holds a complete setup. A discount code replaces it.">
        <div className="grid gap-5 md:grid-cols-[180px_minmax(0,1fr)]">
          <NumberField label="Discount" name="percent" suffix="%" value={percent} onChange={onPercent} max={50} hint="0 turns it off. Up to 50." />
          <fieldset>
            <legend className="mb-1.5 text-xs font-medium text-muted">A complete setup has a product from each of these categories</legend>
            <div className="flex flex-wrap gap-2">
              {chips.map((cat) => {
                const on = chosen.includes(cat.slug);
                return (
                  <label
                    key={cat.slug}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blaze",
                      on ? "border-blaze/60 bg-blaze/10 text-fg" : "border-line-strong text-muted hover:text-fg",
                    )}
                  >
                    <input type="checkbox" className="sr-only" checked={on} onChange={() => onCategories(on ? chosen.filter((s) => s !== cat.slug) : [...chosen, cat.slug])} />
                    <span className={cn("grid size-4 place-items-center rounded border", on ? "border-blaze bg-blaze text-white" : "border-line-strong")}>{on && <Check className="size-3" strokeWidth={3} />}</span>
                    {cat.name}
                  </label>
                );
              })}
            </div>
            <FieldError name="discountCategories" />
          </fieldset>
        </div>
        {missing.length > 0 && (
          <Warning>
            The builder doesn&apos;t offer anything from {missing.join(" or ")}, so a setup built with it won&apos;t get the discount. Untick {missing.length > 1 ? "them" : "it"} above, or add such a product to one of the steps.
          </Warning>
        )}
      </Card>

      <Card title="Heading & intro" description="The top of the builder on the shop page.">
        <div className="space-y-4">
          <TextField label="Small label above the heading" name="intro.kicker" value={c.intro.kicker} onChange={(kicker) => onChange({ kicker })} max={40} hint="Leave empty to hide it." />
          <HeadingField label="Heading while the bundle discount is on" name="intro.headingDiscount" value={c.intro.headingDiscount} onChange={(headingDiscount) => onChange({ headingDiscount })} percent={percent} hint="{percent} shows the discount, e.g. 10." />
          <HeadingField label="Heading when there's no discount" name="intro.heading" value={c.intro.heading} onChange={(heading) => onChange({ heading })} percent={percent} />
          <TextField label="Intro text" name="intro.text" value={c.intro.text} onChange={(text) => onChange({ text })} rows={2} max={300} hint={`{questions} shows how many questions customers answer (now ${questions}).`} />
          <TextField label="Added to the intro while the discount is on" name="intro.discountText" value={c.intro.discountText} onChange={(discountText) => onChange({ discountText })} rows={2} max={300} hint="{percent} shows the discount." />
        </div>
      </Card>
    </>
  );
}

function BudgetPanel({ value: b, onChange, inputStep, products, open }: PanelProps<"budget"> & { inputStep: Config["input"] }) {
  const inputs = inputStep.options.map((o) => products.find((p) => p.slug === o.product)).filter((p): p is BuilderProduct => Boolean(p));
  return (
    <>
      <Card title="Question" description="Always asked first: this is where customers pick their DMA card.">
        <StepFields name="budget" value={b} onChange={onChange} />
      </Card>
      <Card title="Budget options" description="Each option is a card customers choose from. It sets the DMA card and can suggest an input device.">
        <ItemList
          name="budget.tiers"
          items={b.tiers}
          onChange={(tiers) => onChange({ tiers })}
          create={() => ({ id: newId("tier"), name: "", description: "", badge: "", card: "", input: "" })}
          addLabel="Add a budget option"
          title={(t, i) => t.name || `Option ${i + 1}`}
          min={1}
          max={6}
          render={(t, set, i) => (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Name" name={`budget.tiers.${i}.name`} value={t.name} onChange={(name) => set({ name })} max={40} placeholder="Recommended" />
              <TextField label="Badge" name={`budget.tiers.${i}.badge`} value={t.badge} onChange={(badge) => set({ badge })} max={24} placeholder="Most popular" hint="Optional small label on the card." />
              <TextField label="Description" name={`budget.tiers.${i}.description`} value={t.description} onChange={(description) => set({ description })} rows={2} max={200} className="sm:col-span-2" />
              <ProductField label="DMA card" name={`budget.tiers.${i}.card`} value={t.card} onChange={(card) => set({ card })} products={products} />
              <Field label="Suggested input device" name={`budget.tiers.${i}.input`} hint={inputStep.enabled ? "Picked for the customer on the input device question. They can change it." : "The input device question is off, so this isn't used."}>
                <Select name={`budget.tiers.${i}.input`} value={t.input} onChange={(e) => set({ input: e.target.value })} disabled={!inputStep.enabled}>
                  <option value="">None</option>
                  {inputs.map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {p.name}
                    </option>
                  ))}
                  {t.input && !inputs.some((p) => p.slug === t.input) && <option value={t.input}>Not in the input device list</option>}
                </Select>
              </Field>
            </div>
          )}
        />
      </Card>
      <Wording open={open}>
        <TextField label="Name of this part in the setup" name="budget.role" value={b.role} onChange={(role) => onChange({ role })} max={40} />
        <TextField label="Price line on each option" name="budget.fromPrice" value={b.fromPrice} onChange={(fromPrice) => onChange({ fromPrice })} max={60} hint="{price} shows what a full setup starts at." />
        <TextField label="What it does" name="budget.whatItDoes" value={b.whatItDoes} onChange={(whatItDoes) => onChange({ whatItDoes })} rows={2} max={200} className="sm:col-span-2" />
        <TextField label="When the card isn't available" name="budget.comingSoon" value={b.comingSoon} onChange={(comingSoon) => onChange({ comingSoon })} max={40} />
      </Wording>
    </>
  );
}

function MonitorPanel({ value: m, onChange, products, open }: PanelProps<"monitor">) {
  const fuserProducts = m.fusers.map((f) => products.find((p) => p.slug === f.product)).filter((p): p is BuilderProduct => Boolean(p));
  return (
    <>
      <Card title="Question" description="Matches a video fuser to the customer's monitor." actions={<Toggle label="Ask this question" checked={m.enabled} onCheckedChange={(enabled) => onChange({ enabled })} />}>
        {m.enabled ? <StepFields name="monitor" value={m} onChange={onChange} /> : <Off>Customers skip this question and setups don&apos;t include a fuser.</Off>}
      </Card>
      {m.enabled && (
        <>
          <Card title="Screen sizes" description="The first one is selected when the question opens.">
            <ItemList
              name="monitor.screens"
              items={m.screens}
              onChange={(screens) => {
                // Forget the fuser limits of sizes that were removed.
                const ids = new Set(screens.map((s) => s.id));
                onChange({ screens, fusers: m.fusers.map((f) => ({ ...f, maxHz: Object.fromEntries(Object.entries(f.maxHz).filter(([id]) => ids.has(id))) })) });
              }}
              create={() => ({ id: newId("screen"), label: "", detail: "" })}
              addLabel="Add a screen size"
              title={(s, i) => s.label || `Size ${i + 1}`}
              max={8}
              render={(s, set, i) => (
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="Name" name={`monitor.screens.${i}.label`} value={s.label} onChange={(label) => set({ label })} max={40} placeholder="Full HD" />
                  <TextField label="Details" name={`monitor.screens.${i}.detail`} value={s.detail} onChange={(detail) => set({ detail })} max={80} placeholder="1920 × 1080" />
                </div>
              )}
            />
          </Card>

          <Card title="Speeds" description="Refresh rates customers choose from. They're shown from slowest to fastest; speeds no fuser can drive on the chosen screen are greyed out.">
            <ItemList
              name="monitor.speeds"
              items={m.speeds}
              onChange={(speeds) => onChange({ speeds })}
              create={() => ({ hz: NaN, label: "", detail: "" })}
              addLabel="Add a speed"
              title={(s, i) => s.label || `Speed ${i + 1}`}
              max={8}
              render={(s, set, i) => (
                <div className="grid gap-4 sm:grid-cols-3">
                  <NumberField label="Refresh rate" name={`monitor.speeds.${i}.hz`} suffix="Hz" value={s.hz} onChange={(hz) => set({ hz })} max={1000} hint="Used to match fusers." />
                  <TextField label="Name" name={`monitor.speeds.${i}.label`} value={s.label} onChange={(label) => set({ label })} max={20} placeholder="144 Hz" />
                  <TextField label="Details" name={`monitor.speeds.${i}.detail`} value={s.detail} onChange={(detail) => set({ detail })} max={40} placeholder="Gaming" />
                </div>
              )}
            />
            <Field label="Selected when the question opens" name="monitor.defaultHz" className="mt-4 max-w-xs">
              <Select name="monitor.defaultHz" value={shown(m.defaultHz)} onChange={(e) => onChange({ defaultHz: toNumber(e.target.value) })}>
                {!m.speeds.some((s) => s.hz === m.defaultHz) && <option value="">Choose a speed…</option>}
                {m.speeds
                  .filter((s) => Number.isFinite(s.hz))
                  .map((s, i) => (
                    <option key={i} value={s.hz}>
                      {s.label || `${s.hz} Hz`}
                    </option>
                  ))}
              </Select>
            </Field>
          </Card>

          <Card title="Video fusers" description="For each screen size, enter the highest refresh rate the fuser can drive (0 if it can't). The builder picks the cheapest fuser that handles the customer's screen and speed.">
            <ItemList
              name="monitor.fusers"
              items={m.fusers}
              onChange={(fusers) => onChange({ fusers })}
              create={(): BuilderFuser => ({ product: "", maxHz: {} })}
              addLabel="Add a fuser"
              title={(f, i) => products.find((p) => p.slug === f.product)?.name ?? `Fuser ${i + 1}`}
              max={10}
              render={(f, set, i) => (
                <div className="space-y-4">
                  <ProductField label="Product" name={`monitor.fusers.${i}.product`} value={f.product} onChange={(product) => set({ product })} products={products} className="max-w-md" />
                  {m.screens.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      {m.screens.map((s, j) => (
                        <NumberField
                          key={s.id}
                          label={`${s.label || `Size ${j + 1}`} up to`}
                          name={`monitor.fusers.${i}.maxHz.${s.id}`}
                          suffix="Hz"
                          value={f.maxHz[s.id] ?? 0}
                          onChange={(hz) => set({ maxHz: { ...f.maxHz, [s.id]: hz } })}
                          max={1000}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-dim">Add a screen size above to enter this fuser&apos;s limits.</p>
                  )}
                </div>
              )}
            />
            <Field label="For customers who aren't sure" name="monitor.unsureFuser" hint="Choose the fuser that works with the most monitors." className="mt-4 max-w-md">
              <Select name="monitor.unsureFuser" value={m.unsureFuser} onChange={(e) => onChange({ unsureFuser: e.target.value })}>
                {!fuserProducts.some((p) => p.slug === m.unsureFuser) && <option value="">Choose a fuser…</option>}
                {fuserProducts.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
          </Card>

          <Wording open={open}>
            <TextField label="Name of this part in the setup" name="monitor.role" value={m.role} onChange={(role) => onChange({ role })} max={40} />
            <TextField label="What it does" name="monitor.whatItDoes" value={m.whatItDoes} onChange={(whatItDoes) => onChange({ whatItDoes })} max={200} />
            <TextField label="Heading above the screen sizes" name="monitor.screenHeading" value={m.screenHeading} onChange={(screenHeading) => onChange({ screenHeading })} max={40} />
            <TextField label="Heading above the speeds" name="monitor.speedHeading" value={m.speedHeading} onChange={(speedHeading) => onChange({ speedHeading })} max={40} />
            <TextField label="“Not sure” button" name="monitor.unsureTitle" value={m.unsureTitle} onChange={(unsureTitle) => onChange({ unsureTitle })} max={60} />
            <TextField label="“Not sure” help" name="monitor.unsureText" value={m.unsureText} onChange={(unsureText) => onChange({ unsureText })} max={200} />
            <TextField label="Label above the matched fuser" name="monitor.previewHeading" value={m.previewHeading} onChange={(previewHeading) => onChange({ previewHeading })} max={40} />
            <TextField label="Under the matched fuser" name="monitor.matchCaption" value={m.matchCaption} onChange={(matchCaption) => onChange({ matchCaption })} max={120} hint="{screen} and {speed} show the customer's choices." />
            <TextField label="Under the fuser for “not sure”" name="monitor.unsureCaption" value={m.unsureCaption} onChange={(unsureCaption) => onChange({ unsureCaption })} max={120} />
            <TextField label="Summary answer for “not sure”" name="monitor.recapUnsure" value={m.recapUnsure} onChange={(recapUnsure) => onChange({ recapUnsure })} max={40} />
            <TextField label="When no fuser fits" name="monitor.noMatch" value={m.noMatch} onChange={(noMatch) => onChange({ noMatch })} rows={2} max={200} className="sm:col-span-2" />
          </Wording>
        </>
      )}
    </>
  );
}

function PcPanel({ value: pc, onChange, products, open }: PanelProps<"pc">) {
  return (
    <>
      <Card title="Question" description="Offers a second computer for customers who don't have one." actions={<Toggle label="Ask this question" checked={pc.enabled} onCheckedChange={(enabled) => onChange({ enabled })} />}>
        {pc.enabled ? <StepFields name="pc" value={pc} onChange={onChange} /> : <Off>Customers skip this question and setups never include a computer.</Off>}
      </Card>
      {pc.enabled && (
        <>
          <Card title="Computer to offer">
            <ProductField label="Product" name="pc.product" value={pc.product} onChange={(product) => onChange({ product })} products={products} className="max-w-md" />
          </Card>
          <Card title="Answers">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="“I have one” answer" name="pc.haveTitle" value={pc.haveTitle} onChange={(haveTitle) => onChange({ haveTitle })} max={60} />
              <TextField label="Its description" name="pc.haveText" value={pc.haveText} onChange={(haveText) => onChange({ haveText })} max={200} />
              <TextField label="“Add one for me” answer" name="pc.needTitle" value={pc.needTitle} onChange={(needTitle) => onChange({ needTitle })} max={60} />
              <TextField label="Its description" name="pc.needText" value={pc.needText} onChange={(needText) => onChange({ needText })} max={200} hint="{product} shows the computer's name." />
              <TextField label="When the computer isn't available" name="pc.unavailable" value={pc.unavailable} onChange={(unavailable) => onChange({ unavailable })} max={200} className="sm:col-span-2" />
            </div>
          </Card>
          <Wording open={open}>
            <TextField label="Name of this part in the setup" name="pc.role" value={pc.role} onChange={(role) => onChange({ role })} max={40} />
            <TextField label="What it does" name="pc.whatItDoes" value={pc.whatItDoes} onChange={(whatItDoes) => onChange({ whatItDoes })} max={200} />
            <TextField label="Summary answer: has one" name="pc.recapHave" value={pc.recapHave} onChange={(recapHave) => onChange({ recapHave })} max={40} />
            <TextField label="Summary answer: we add one" name="pc.recapNeed" value={pc.recapNeed} onChange={(recapNeed) => onChange({ recapNeed })} max={40} />
          </Wording>
        </>
      )}
    </>
  );
}

function InputPanel({ value: inp, onChange, products, open }: PanelProps<"input">) {
  return (
    <>
      <Card title="Question" description="Offers an input device." actions={<Toggle label="Ask this question" checked={inp.enabled} onCheckedChange={(enabled) => onChange({ enabled })} />}>
        {inp.enabled ? <StepFields name="input" value={inp} onChange={onChange} /> : <Off>Customers skip this question and setups don&apos;t include an input device.</Off>}
      </Card>
      {inp.enabled && (
        <>
          <Card title="Input devices" description="Each one is a card customers can pick. A budget option can suggest one of them.">
            <ItemList
              name="input.options"
              items={inp.options}
              onChange={(options) => onChange({ options })}
              create={() => ({ product: "", title: "", description: "" })}
              addLabel="Add an input device"
              title={(o, i) => products.find((p) => p.slug === o.product)?.name ?? `Device ${i + 1}`}
              max={6}
              render={(o, set, i) => (
                <div className="grid gap-4 sm:grid-cols-2">
                  <ProductField label="Product" name={`input.options.${i}.product`} value={o.product} onChange={(product) => set({ product })} products={products} className="sm:col-span-2 sm:max-w-md" />
                  <TextField label="Title" name={`input.options.${i}.title`} value={o.title} onChange={(title) => set({ title })} max={40} placeholder="Premium" hint="Empty: the product name." />
                  <TextField label="Description" name={`input.options.${i}.description`} value={o.description} onChange={(description) => set({ description })} max={200} hint="Empty: the product's tagline." />
                </div>
              )}
            />
          </Card>
          <Card title="“No thanks” answer" actions={<Toggle label="Offer it" checked={inp.noneEnabled} onCheckedChange={(noneEnabled) => onChange({ noneEnabled })} />}>
            {inp.noneEnabled ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Title" name="input.noneTitle" value={inp.noneTitle} onChange={(noneTitle) => onChange({ noneTitle })} max={60} />
                <TextField label="Description" name="input.noneText" value={inp.noneText} onChange={(noneText) => onChange({ noneText })} max={200} />
              </div>
            ) : (
              <Off>Customers have to pick one of the devices above.</Off>
            )}
          </Card>
          <Wording open={open}>
            <TextField label="Name of this part in the setup" name="input.role" value={inp.role} onChange={(role) => onChange({ role })} max={40} />
            <TextField label="What it does" name="input.whatItDoes" value={inp.whatItDoes} onChange={(whatItDoes) => onChange({ whatItDoes })} max={200} />
            <TextField label="Badge on the suggested device" name="input.suggestedBadge" value={inp.suggestedBadge} onChange={(suggestedBadge) => onChange({ suggestedBadge })} max={24} hint="Leave empty to show no badge." />
            <TextField label="Summary answer when there's no device" name="input.recapNone" value={inp.recapNone} onChange={(recapNone) => onChange({ recapNone })} max={40} />
          </Wording>
        </>
      )}
    </>
  );
}

function SummaryPanel({ value: s, onChange, products, open, percent }: PanelProps<"summary"> & { percent: number }) {
  return (
    <>
      <Card title="Question" description="The last step: the finished setup, add-ons and the button that adds it all to the cart.">
        <StepFields name="summary" value={s} onChange={onChange} />
      </Card>
      <Card title="Add-ons" description="Extras customers can add to their setup with one click.">
        <ItemList
          name="summary.addons"
          items={s.addons}
          onChange={(addons) => onChange({ addons })}
          create={() => ({ product: "", description: "" })}
          addLabel="Add an add-on"
          title={(a, i) => products.find((p) => p.slug === a.product)?.name ?? `Add-on ${i + 1}`}
          max={12}
          render={(a, set, i) => (
            <div className="grid gap-4 sm:grid-cols-2">
              <ProductField label="Product" name={`summary.addons.${i}.product`} value={a.product} onChange={(product) => set({ product })} products={products} />
              <TextField label="What it does" name={`summary.addons.${i}.description`} value={a.description} onChange={(description) => set({ description })} max={200} hint="Empty: the product's tagline." />
            </div>
          )}
        />
      </Card>
      <Wording open={open}>
        <TextField label="Button on the last question" name="summary.seeButton" value={s.seeButton} onChange={(seeButton) => onChange({ seeButton })} max={40} />
        <TextField label="Heading above the add-ons" name="summary.addonsHeading" value={s.addonsHeading} onChange={(addonsHeading) => onChange({ addonsHeading })} max={60} />
        <TextField label="Name of an add-on in the setup" name="summary.addonRole" value={s.addonRole} onChange={(addonRole) => onChange({ addonRole })} max={40} />
        <TextField
          label="Discount hint before the setup is complete"
          name="summary.discountHint"
          value={s.discountHint}
          onChange={(discountHint) => onChange({ discountHint })}
          max={200}
          hint={`{percent} shows the discount (now ${Number.isFinite(percent) ? percent : 0}).`}
        />
        <TextField label="Add to cart button" name="summary.addButton" value={s.addButton} onChange={(addButton) => onChange({ addButton })} max={40} />
        <TextField label="After adding to the cart" name="summary.addedButton" value={s.addedButton} onChange={(addedButton) => onChange({ addedButton })} max={40} />
        <TextField label="Note under the button" name="summary.note" value={s.note} onChange={(note) => onChange({ note })} max={200} />
        <TextField label="Start over link" name="summary.startOver" value={s.startOver} onChange={(startOver) => onChange({ startOver })} max={40} />
      </Wording>
    </>
  );
}

/* ───────────── pieces ───────────── */

/** Categories the discount needs that nothing in the builder belongs to. */
function unreachableCategories(c: Config, products: BuilderProduct[]) {
  const offered = new Set<string>();
  const add = (slug: string) => {
    const cat = products.find((p) => p.slug === slug)?.category;
    if (cat) offered.add(cat);
  };
  c.budget.tiers.forEach((t) => add(t.card));
  if (c.monitor.enabled) c.monitor.fusers.forEach((f) => add(f.product));
  if (c.pc.enabled) add(c.pc.product);
  if (c.input.enabled) c.input.options.forEach((o) => add(o.product));
  c.summary.addons.forEach((a) => add(a.product));
  return c.discountCategories.filter((cat) => !offered.has(cat));
}

function StepFields<T extends StepCopy>({ name, value, onChange }: { name: string; value: T; onChange: (p: Partial<T>) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <TextField label="Short name" name={`${name}.label`} value={value.label} onChange={(label) => onChange({ label } as Partial<T>)} max={24} hint="In the progress bar and the summary." />
      <TextField label="Question" name={`${name}.title`} value={value.title} onChange={(title) => onChange({ title } as Partial<T>)} max={120} />
      <TextField label="Help text" name={`${name}.hint`} value={value.hint} onChange={(hint) => onChange({ hint } as Partial<T>)} rows={2} max={300} className="sm:col-span-2" />
    </div>
  );
}

function HeadingField({ label, name, value, onChange, percent, hint }: { label: string; name: string; value: Heading; onChange: (h: Heading) => void; percent: number; hint?: string }) {
  const vars = { percent: Number.isFinite(percent) ? percent : 0 };
  return (
    <div className="rounded-xl border border-line bg-ink-950/40 p-4">
      <p className="mb-3 text-xs font-medium text-muted">{label}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Plain text" name={`${name}.text`} value={value.text} onChange={(text) => onChange({ ...value, text })} max={80} />
        <TextField label="Highlighted text (orange)" name={`${name}.highlight`} value={value.highlight} onChange={(highlight) => onChange({ ...value, highlight })} max={80} hint={hint} />
      </div>
      <div className="mt-3">
        <Toggle label="Put the highlighted text on its own line" checked={value.newLine} onCheckedChange={(newLine) => onChange({ ...value, newLine })} />
      </div>
      <p className="mt-4 border-t border-line pt-3 font-display text-2xl uppercase leading-tight" aria-label="Heading preview">
        {fill(value.text, vars)}
        {value.text && value.highlight && (value.newLine ? <br /> : " ")}
        <span className="text-gradient">{fill(value.highlight, vars)}</span>
      </p>
    </div>
  );
}

function TextField({
  label,
  name,
  value,
  onChange,
  hint,
  max,
  rows,
  placeholder,
  className,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  hint?: ReactNode;
  max?: number;
  rows?: number;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Field label={label} name={name} hint={hint} className={className}>
      {rows ? (
        <Textarea name={name} value={value} onChange={(e) => onChange(e.target.value)} maxLength={max} rows={rows} placeholder={placeholder} className="min-h-0" />
      ) : (
        <Input name={name} value={value} onChange={(e) => onChange(e.target.value)} maxLength={max} placeholder={placeholder} />
      )}
    </Field>
  );
}

function NumberField({ label, name, value, onChange, suffix, max, hint, className }: { label: string; name: string; value: number; onChange: (n: number) => void; suffix?: string; max?: number; hint?: ReactNode; className?: string }) {
  return (
    <Field label={label} name={name} hint={hint} className={className}>
      <span className="relative block">
        <Input name={name} type="number" inputMode="numeric" min={0} max={max} step={1} value={shown(value)} onChange={(e) => onChange(toNumber(e.target.value))} className={cn("tabular-nums", suffix && "pr-10")} />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-dim">{suffix}</span>}
      </span>
    </Field>
  );
}

const STATUS_NOTE = {
  draft: "This product is a draft, so customers won't see it here until it's published.",
  archived: "This product is archived, so customers won't see it here.",
} as const;

/** Every product, grouped by category, with drafts and missing products called out. */
function ProductField({ label, name, value, onChange, products, hint, className }: { label: string; name: string; value: string; onChange: (slug: string) => void; products: BuilderProduct[]; hint?: ReactNode; className?: string }) {
  const selected = products.find((p) => p.slug === value);
  const groups = new Map<string, BuilderProduct[]>();
  for (const p of products) groups.set(p.categoryName, [...(groups.get(p.categoryName) ?? []), p]);
  const note = selected && selected.status !== "active" ? <span className="text-warn">{STATUS_NOTE[selected.status]}</span> : value && !selected ? <span className="text-warn">This product no longer exists. Pick another one.</span> : hint;
  return (
    <Field label={label} name={name} hint={note} className={className}>
      <Select name={name} value={value} onChange={(e) => onChange(e.target.value)}>
        {!value && <option value="">Choose a product…</option>}
        {value && !selected && <option value={value}>Missing product</option>}
        {[...groups].map(([category, items]) => (
          <optgroup key={category} label={category}>
            {items.map((p) => (
              <option key={p.slug} value={p.slug}>
                {`${p.name} · ${formatPrice(p.price)}${p.status === "active" ? "" : ` (${p.status})`}`}
              </option>
            ))}
          </optgroup>
        ))}
      </Select>
    </Field>
  );
}

/** A list the admin can add to, remove from and reorder. */
function ItemList<T>({
  name,
  items,
  onChange,
  create,
  addLabel,
  title,
  render,
  min = 0,
  max,
}: {
  name: string;
  items: T[];
  onChange: (items: T[]) => void;
  create: () => T;
  addLabel: string;
  title: (item: T, i: number) => string;
  render: (item: T, set: (p: Partial<T>) => void, i: number) => ReactNode;
  min?: number;
  max: number;
}) {
  const move = (i: number, by: number) => {
    const next = [...items];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const label = title(item, i);
        return (
          <div key={i} className="rounded-xl border border-line bg-ink-950/40 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="truncate font-mono text-[10.5px] uppercase tracking-[0.16em] text-dim">{label}</p>
              <div className="flex shrink-0 gap-1">
                <IconButton label={`Move ${label} up`} onClick={() => move(i, -1)} disabled={i === 0}>
                  <ArrowUp className="size-3.5" />
                </IconButton>
                <IconButton label={`Move ${label} down`} onClick={() => move(i, 1)} disabled={i === items.length - 1}>
                  <ArrowDown className="size-3.5" />
                </IconButton>
                <IconButton label={`Remove ${label}`} onClick={() => onChange(items.filter((_, j) => j !== i))} disabled={items.length <= min}>
                  <Trash2 className="size-3.5" />
                </IconButton>
              </div>
            </div>
            {render(item, (p) => onChange(items.map((x, j) => (j === i ? { ...x, ...p } : x))), i)}
          </div>
        );
      })}
      <FieldError name={name} />
      {items.length < max && (
        <button type="button" onClick={() => onChange([...items, create()])} className={buttonClass("secondary", "sm")}>
          <Plus className="size-3.5" /> {addLabel}
        </button>
      )}
    </div>
  );
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="grid size-8 place-items-center rounded-lg text-dim transition-colors hover:bg-white/5 hover:text-fg disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/** Error for a whole list or group (single fields show theirs through <Field>). */
function FieldError({ name }: { name: string }) {
  const { state } = useActionForm();
  const error = state?.ok === false ? state.fieldErrors?.[name] : undefined;
  return error ? <p className="text-xs text-[#ff6b5e]">{error}</p> : null;
}

/** The smaller texts of a step, folded away until wanted (or until one needs fixing). */
function Wording({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <details open={open || undefined} className="group rounded-2xl border border-line bg-ink-900/70">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-sm font-semibold text-fg">More wording</span>
          <span className="mt-0.5 block text-xs text-dim">Smaller texts in this step. The originals work well, so change them only if you want to.</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-dim transition-transform group-open:rotate-180" />
      </summary>
      <div className="grid gap-4 border-t border-line p-5 sm:grid-cols-2">{children}</div>
    </details>
  );
}

function Off({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}

function Warning({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 flex items-start gap-2 rounded-xl border border-warn/30 bg-warn/10 p-3 text-sm text-warn">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
