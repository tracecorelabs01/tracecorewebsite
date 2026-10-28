"use client";

import { useId, useState, type ReactNode } from "react";
import { Check, Info, ShoppingBag } from "lucide-react";
import type { Product } from "@/lib/catalog/types";
import { useStoreSettings } from "@/components/layout/StoreSettings";
import { ProductVisual } from "@/components/product/ProductVisual";
import { Button } from "@/components/ui/Button";
import { Kicker } from "@/components/ui/bits";
import { useCart } from "@/lib/cart-store";
import { REFRESH_RATES, RESOLUTIONS, SETUP_SLUGS, FUSERS, fuserFor, isCompleteSetup, type Resolution } from "@/lib/setup-builder";
import { useUi } from "@/lib/ui-store";
import { cn, formatPrice } from "@/lib/utils";

type Pick = { role: string; product?: Product; missing?: string };

export function SetupBuilder({ products }: { products: Product[] }) {
  const { setupDiscountPercent } = useStoreSettings();
  const add = useCart((s) => s.add);
  const openCart = useUi((s) => s.openCart);

  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const listed = (slugs: readonly string[]) => slugs.map((s) => bySlug.get(s)).filter((p): p is Product => Boolean(p));
  const cards = listed(SETUP_SLUGS.cards);
  const inputs = listed(SETUP_SLUGS.inputs);
  const fusers = listed(Object.keys(FUSERS));
  const miniPc = bySlug.get(SETUP_SLUGS.miniPc);
  const adapter = bySlug.get(SETUP_SLUGS.adapter);

  const [platform, setPlatform] = useState<"desktop" | "laptop">("desktop");
  const [secondPc, setSecondPc] = useState<"have" | "need">("have");
  const [resolution, setResolution] = useState<Resolution>("1080p");
  const [hz, setHz] = useState<number>(144);
  const [input, setInput] = useState<string>(inputs[0]?.slug ?? "none");
  const [card, setCard] = useState<string | undefined>((bySlug.get("tracecore-75t") ?? cards[0])?.slug);

  const fuser = fuserFor(fusers, resolution, hz);
  const picks: Pick[] = [
    { role: "DMA card", product: card ? bySlug.get(card) : undefined, missing: "No DMA cards are available right now." },
    { role: "Video fuser", product: fuser, missing: fusers.length ? "None of our fusers drives this display yet. Contact support and we'll help." : "Fusers are coming soon." },
    ...(input !== "none" ? [{ role: "Input controller", product: bySlug.get(input) }] : []),
    ...(secondPc === "need" ? [{ role: "Second PC", product: miniPc, missing: "The Mini PC is coming soon." }] : []),
    ...(platform === "laptop" ? [{ role: "Laptop adapter", product: adapter, missing: "The TB-PCIe adapter is coming soon." }] : []),
  ];
  const buyable = picks.flatMap((p) => (p.product && p.product.status !== "sold-out" ? [p.product] : []));
  const subtotal = buyable.reduce((n, p) => n + p.price, 0);
  const complete = setupDiscountPercent > 0 && isCompleteSetup(buyable.map((p) => p.category));
  const discount = complete ? Math.round(subtotal * setupDiscountPercent) / 100 : 0;

  function addSetup() {
    for (const p of buyable) add(p, 1, p.option?.values[0]);
    openCart();
  }

  return (
    <section className="container-x grid gap-8 pb-28 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12">
      <div className="space-y-5">
        <Step index="01" title="What's your main PC?">
          <Choices>
            <Option name="platform" checked={platform === "desktop"} onChange={() => setPlatform("desktop")} title="Desktop" sub="Has a free PCIe slot for the DMA card." />
            <Option name="platform" checked={platform === "laptop"} onChange={() => setPlatform("laptop")} title="Laptop" sub="We'll add the TB-PCIe adapter so the card connects over Thunderbolt or USB4." />
          </Choices>
        </Step>

        <Step index="02" title="Do you have a second PC?" hint="The DMA card's host software runs on a separate computer.">
          <Choices>
            <Option name="second-pc" checked={secondPc === "have"} onChange={() => setSecondPc("have")} title="Yes, I have one" />
            <Option name="second-pc" checked={secondPc === "need"} onChange={() => setSecondPc("need")} title="No, add one" sub={miniPc ? `${miniPc.name}: ${miniPc.tagline}` : "Our Mini PC is coming soon."} aside={miniPc && formatPrice(miniPc.price)} />
          </Choices>
        </Step>

        <Step index="03" title="Your main display" hint="We'll match the fuser that handles your resolution and refresh rate.">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-dim">Resolution</p>
          <Pills>
            {RESOLUTIONS.map((r) => (
              <Pill key={r.id} name="resolution" checked={resolution === r.id} onChange={() => setResolution(r.id)}>
                {r.label}
              </Pill>
            ))}
          </Pills>
          <p className="mb-2 mt-5 font-mono text-[11px] uppercase tracking-[0.14em] text-dim">Refresh rate</p>
          <Pills>
            {REFRESH_RATES.map((r) => (
              <Pill key={r} name="refresh" checked={hz === r} onChange={() => setHz(r)}>
                {r} Hz
              </Pill>
            ))}
          </Pills>
          <p className="mt-5 flex items-start gap-2 text-sm text-muted" aria-live="polite">
            <Info className="mt-0.5 size-4 shrink-0 text-blaze" />
            {fuser ? (
              <span>
                <span className="text-fg">{fuser.name}</span> handles {RESOLUTIONS.find((r) => r.id === resolution)!.label} at {hz} Hz.
              </span>
            ) : (
              <span>{fusers.length ? "None of our fusers drives this display yet. Contact support and we'll help." : "Video fusers are coming soon."}</span>
            )}
          </p>
        </Step>

        <Step index="04" title="Input controller">
          <Choices>
            {inputs.map((p) => (
              <Option key={p.slug} name="input" checked={input === p.slug} onChange={() => setInput(p.slug)} title={p.name} sub={p.tagline} aside={formatPrice(p.price)} disabled={p.status === "sold-out"} />
            ))}
            <Option name="input" checked={input === "none"} onChange={() => setInput("none")} title="I already have one" />
          </Choices>
        </Step>

        <Step index="05" title="DMA card">
          <Choices>
            {cards.map((p) => (
              <Option key={p.slug} name="card" checked={card === p.slug} onChange={() => setCard(p.slug)} title={p.name} sub={p.tagline} aside={formatPrice(p.price)} disabled={p.status === "sold-out"} />
            ))}
          </Choices>
        </Step>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-3xl border border-line bg-ink-900/60 p-5 sm:p-7">
          <Kicker>Your setup</Kicker>
          <ul className="mt-5 divide-y divide-line">
            {picks.map((p) => (
              <li key={p.role} className="flex items-center gap-3 py-3">
                <div className="relative size-14 shrink-0 overflow-hidden rounded-xl border border-line bg-ink-950">{p.product && <ProductVisual visual={p.product.visual} variant="thumb" />}</div>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-dim">{p.role}</p>
                  {p.product ? (
                    <p className="truncate text-sm">{p.product.name}</p>
                  ) : (
                    <p className="text-sm text-muted">{p.missing}</p>
                  )}
                  {p.product?.status === "sold-out" && <p className="text-xs text-ember">Sold out</p>}
                </div>
                {p.product && p.product.status !== "sold-out" && <span className="font-mono text-sm">{formatPrice(p.product.price)}</span>}
              </li>
            ))}
          </ul>

          <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd>{formatPrice(subtotal)}</dd>
            </div>
            {complete && (
              <div className="flex justify-between">
                <dt className="text-muted">Setup discount ({setupDiscountPercent}%)</dt>
                <dd className="text-ok">−{formatPrice(discount)}</dd>
              </div>
            )}
            <div className="flex items-baseline justify-between border-t border-line pt-3">
              <dt className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Total</dt>
              <dd className="font-display text-3xl">{formatPrice(subtotal - discount)}</dd>
            </div>
          </dl>
          {setupDiscountPercent > 0 && !complete && (
            <p className="mt-3 text-xs text-muted">Add a DMA card, a fuser and an input controller to get {setupDiscountPercent}% off the full setup.</p>
          )}

          <Button className="mt-6 w-full" size="lg" onClick={addSetup} disabled={!buyable.length} icon={<ShoppingBag className="size-4" />}>
            Add setup to cart
          </Button>
          <p className="mt-3 text-center text-xs text-dim">Shipping and the setup discount are confirmed at checkout.</p>
        </div>
      </aside>
    </section>
  );
}

function Step({ index, title, hint, children }: { index: string; title: string; hint?: string; children: ReactNode }) {
  const id = useId();
  return (
    <fieldset aria-labelledby={id} className="rounded-3xl border border-line bg-ink-900/40 p-5 sm:p-7">
      <Kicker index={index}>Step</Kicker>
      <h2 id={id} className="mt-3 font-display text-2xl uppercase sm:text-3xl">
        {title}
      </h2>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      <div className="mt-5">{children}</div>
    </fieldset>
  );
}

const Choices = ({ children }: { children: ReactNode }) => <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
const Pills = ({ children }: { children: ReactNode }) => <div className="flex flex-wrap gap-2">{children}</div>;

function Option({ name, checked, onChange, title, sub, aside, disabled }: { name: string; checked: boolean; onChange: () => void; title: string; sub?: string; aside?: ReactNode; disabled?: boolean }) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blaze",
        checked ? "border-blaze bg-blaze/10" : "border-line bg-ink-950/40 hover:border-line-strong",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} disabled={disabled} className="sr-only" />
      <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border", checked ? "border-blaze bg-blaze text-white" : "border-line-strong")}>
        {checked && <Check className="size-3" strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        {sub && <span className="mt-0.5 block text-sm text-muted">{sub}</span>}
        {disabled && <span className="mt-0.5 block text-xs text-ember">Sold out</span>}
      </span>
      {aside && <span className="shrink-0 font-mono text-sm">{aside}</span>}
    </label>
  );
}

function Pill({ name, checked, onChange, children }: { name: string; checked: boolean; onChange: () => void; children: ReactNode }) {
  return (
    <label
      className={cn(
        "cursor-pointer rounded-full border px-4 py-2 font-mono text-xs tracking-[0.08em] transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blaze",
        checked ? "border-blaze bg-blaze text-white" : "border-line text-muted hover:border-line-strong hover:text-fg",
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      {children}
    </label>
  );
}
