"use client";

import { useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, Info, Pencil, ShoppingBag } from "lucide-react";
import type { Product } from "@/lib/catalog/types";
import { useStoreSettings } from "@/components/layout/StoreSettings";
import { ProductVisual } from "@/components/product/ProductVisual";
import { Button } from "@/components/ui/Button";
import { EASE_EXPO } from "@/components/ui/motion";
import { useCart } from "@/lib/cart-store";
import { FUSERS, REFRESH_RATES, RESOLUTIONS, SETUP_SLUGS, fuserFor, isCompleteSetup, maxHzFor, type Resolution } from "@/lib/setup-builder";
import { useUi } from "@/lib/ui-store";
import { cn, formatPrice } from "@/lib/utils";

const STEPS = [
  { id: "card", label: "DMA card", title: "Pick your DMA card", hint: "Every card is built on a Xilinx Artix-7 FPGA. Bigger FPGAs give more headroom." },
  { id: "display", label: "Display", title: "Tell us about your display", hint: "We'll match the fuser that handles your main monitor's resolution and refresh rate." },
  { id: "input", label: "Input", title: "Choose an input device", hint: "A USB passthrough device that sits between your mouse and PC." },
  { id: "pc", label: "Second PC", title: "Do you have a second PC?", hint: "The DMA card's host software runs on a separate computer." },
  { id: "extras", label: "Extras", title: "Anything else?", hint: "Optional. Pick as many as you like." },
  { id: "review", label: "Review", title: "Your setup", hint: "Check everything over, then add it all to your cart in one go." },
] as const;

type Line = { role: string; step: number; product: Product };

export function SetupBuilder({ products }: { products: Product[] }) {
  const { setupDiscountPercent } = useStoreSettings();
  const add = useCart((s) => s.add);
  const openCart = useUi((s) => s.openCart);
  const reduce = useReducedMotion();

  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const listed = (slugs: readonly string[]) => slugs.flatMap((s) => bySlug.get(s) ?? []);
  const cards = listed(SETUP_SLUGS.cards);
  const inputs = listed(SETUP_SLUGS.inputs);
  const fusers = listed(Object.keys(FUSERS));
  const extras = listed(SETUP_SLUGS.extras);
  const miniPc = bySlug.get(SETUP_SLUGS.miniPc);

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [card, setCard] = useState<string>();
  const [resolution, setResolution] = useState<Resolution>("1080p");
  const [hz, setHz] = useState(144);
  const [ownFuser, setOwnFuser] = useState(false);
  const [input, setInput] = useState<string>();
  const [secondPc, setSecondPc] = useState<"have" | "need">();
  const [extraSlugs, setExtraSlugs] = useState<string[]>([]);
  const [options, setOptions] = useState<Record<string, string>>({});
  const [added, setAdded] = useState(false);

  const fuserSlugs = fusers.map((f) => f.slug);
  const maxHz = maxHzFor(fuserSlugs, resolution);
  const fuser = ownFuser ? undefined : fuserFor(fusers, resolution, hz);
  const pick = (slug?: string) => (slug ? bySlug.get(slug) : undefined);

  const lines: Line[] = [
    { role: "DMA card", step: 0, product: pick(card) },
    { role: "Video fuser", step: 1, product: fuser },
    { role: "Input device", step: 2, product: input === "own" ? undefined : pick(input) },
    { role: "Second PC", step: 3, product: secondPc === "need" ? miniPc : undefined },
    ...extras.filter((p) => extraSlugs.includes(p.slug)).map((p) => ({ role: "Extra", step: 4, product: p })),
  ].filter((l): l is Line => Boolean(l.product) && l.product!.status !== "sold-out");
  const subtotal = lines.reduce((n, l) => n + l.product.price, 0);
  const complete = setupDiscountPercent > 0 && isCompleteSetup(lines.map((l) => l.product.category));
  const discount = complete ? Math.round(subtotal * setupDiscountPercent) / 100 : 0;

  const canContinue = [Boolean(card), ownFuser || Boolean(fuser), Boolean(input), Boolean(secondPc), true, lines.length > 0][step];
  const last = step === STEPS.length - 1;

  // After navigating, focus the new step's heading so keyboard and screen-reader users land in the right place.
  // The new heading only mounts once the old step has animated out, so focus it from its ref callback.
  const focusNext = useRef(false);
  const focusHeading = (el: HTMLHeadingElement | null) => {
    if (el && focusNext.current) {
      focusNext.current = false;
      el.focus();
    }
  };

  function go(to: number) {
    focusNext.current = true;
    setDir(to > step ? 1 : -1);
    setStep(to);
    setAdded(false);
  }

  function changeResolution(r: Resolution) {
    setResolution(r);
    // Keep the refresh rate within what our fusers can drive at the new resolution.
    const cap = maxHzFor(fuserSlugs, r);
    if (!ownFuser && hz > cap) setHz([...REFRESH_RATES].reverse().find((rate) => rate <= cap) ?? REFRESH_RATES[0]);
  }

  function addSetup() {
    for (const l of lines) add(l.product, 1, options[l.product.slug] ?? l.product.option?.values[0]);
    setAdded(true);
    openCart();
  }

  const optionPicker = (p?: Product) =>
    p?.option && p.option.values.length > 1 ? (
      <OptionPicker name={p.option.name} values={p.option.values} value={options[p.slug] ?? p.option.values[0]} onChange={(v) => setOptions((o) => ({ ...o, [p.slug]: v }))} />
    ) : null;

  const slide = {
    enter: (d: number) => ({ opacity: 0, x: reduce ? 0 : d * 56 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: reduce ? 0 : d * -56 }),
  };

  return (
    <section className="container-x pb-28">
      <div className="mx-auto max-w-5xl">
        <Progress step={step} canJump={(i) => i < step} onJump={go} />

        <div className="relative mt-8 overflow-hidden rounded-[28px] border border-line bg-ink-900/50 p-5 sm:p-8">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgb(255_61_0/0.12),transparent_55%)]" />
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div key={step} custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.45, ease: EASE_EXPO }} className="relative">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-blaze">
                Step {step + 1} of {STEPS.length}
              </p>
              <h2 ref={focusHeading} tabIndex={-1} className="mt-2 font-display text-3xl uppercase outline-none sm:text-4xl">
                {STEPS[step].title}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-muted">{STEPS[step].hint}</p>

              <div className="mt-7">
                {step === 0 && (
                  <Choices label="DMA card">
                    {cards.map((p) => (
                      <ProductChoice key={p.slug} name="card" product={p} selected={card === p.slug} onSelect={() => setCard(p.slug)}>
                        {card === p.slug && optionPicker(p)}
                      </ProductChoice>
                    ))}
                  </Choices>
                )}

                {step === 1 && (
                  <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
                    <div>
                      <PillGroup label="Resolution">
                        {RESOLUTIONS.map((r) => (
                          <Pill key={r.id} name="resolution" checked={resolution === r.id} onChange={() => changeResolution(r.id)}>
                            {r.label}
                          </Pill>
                        ))}
                      </PillGroup>
                      <PillGroup label="Refresh rate" className="mt-6">
                        {REFRESH_RATES.map((r) => (
                          <Pill key={r} name="refresh" checked={hz === r} disabled={!ownFuser && r > maxHz} onChange={() => setHz(r)}>
                            {r} Hz
                          </Pill>
                        ))}
                      </PillGroup>
                      <label className="mt-6 flex w-fit cursor-pointer items-center gap-3 text-sm text-muted">
                        <input type="checkbox" checked={ownFuser} onChange={(e) => setOwnFuser(e.target.checked)} className="size-4 accent-[#ff3d00]" />
                        I already have a fuser
                      </label>
                    </div>
                    <div aria-live="polite">
                      <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-dim">Your fuser</p>
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.div key={ownFuser ? "own" : (fuser?.slug ?? "none")} initial={{ opacity: 0, y: reduce ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduce ? 0 : -12 }} transition={{ duration: 0.3, ease: EASE_EXPO }}>
                          {ownFuser ? (
                            <Note>{"No fuser added. You'll use your own."}</Note>
                          ) : fuser ? (
                            <ProductPreview product={fuser} caption={`Handles ${RESOLUTIONS.find((r) => r.id === resolution)!.label} at ${hz} Hz`} />
                          ) : (
                            <Note>{fusers.length ? "None of our fusers drives this display. Pick a lower refresh rate, or contact support." : "Fusers are coming soon."}</Note>
                          )}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <Choices label="Input device">
                    {inputs.map((p) => (
                      <ProductChoice key={p.slug} name="input" product={p} selected={input === p.slug} onSelect={() => setInput(p.slug)}>
                        {input === p.slug && optionPicker(p)}
                      </ProductChoice>
                    ))}
                    <PlainChoice name="input" selected={input === "own"} onSelect={() => setInput("own")} title="I already have one" sub="Skip the input device." />
                  </Choices>
                )}

                {step === 3 && (
                  <Choices label="Second PC">
                    <PlainChoice name="pc" selected={secondPc === "have"} onSelect={() => setSecondPc("have")} title="Yes, I have one" sub="Use your own second computer." />
                    {miniPc ? (
                      <ProductChoice name="pc" product={miniPc} selected={secondPc === "need"} onSelect={() => setSecondPc("need")} kicker="No, add one" />
                    ) : (
                      <PlainChoice name="pc" selected={false} onSelect={() => {}} title="No, add one" sub="Our Mini PC is coming soon." disabled />
                    )}
                  </Choices>
                )}

                {step === 4 && (
                  <Choices label="Extras">
                    {extras.map((p) => {
                      const on = extraSlugs.includes(p.slug);
                      return (
                        <ProductChoice key={p.slug} name="extras" multiple product={p} selected={on} onSelect={() => setExtraSlugs((s) => (on ? s.filter((x) => x !== p.slug) : [...s, p.slug]))}>
                          {on && optionPicker(p)}
                        </ProductChoice>
                      );
                    })}
                  </Choices>
                )}

                {step === 5 && (
                  <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <ul className="divide-y divide-line rounded-2xl border border-line bg-ink-950/40">
                      {lines.length === 0 && <li className="p-5 text-sm text-muted">Nothing selected yet. Go back and pick your parts.</li>}
                      {lines.map((l, i) => (
                        <motion.li
                          key={`${l.role}-${l.product.slug}`}
                          initial={{ opacity: 0, y: reduce ? 0 : 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: reduce ? 0 : 0.05 * i, duration: 0.35, ease: EASE_EXPO }}
                          className="flex items-center gap-4 p-4"
                        >
                          <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-lg border border-line bg-ink-950">
                            <ProductVisual visual={l.product.visual} variant="thumb" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-dim">{l.role}</p>
                            <p className="truncate font-medium">{l.product.name}</p>
                            {l.product.option && <p className="text-xs text-muted">{`${l.product.option.name}: ${options[l.product.slug] ?? l.product.option.values[0]}`}</p>}
                          </div>
                          <span className="font-mono text-sm">{formatPrice(l.product.price)}</span>
                          <button type="button" onClick={() => go(l.step)} aria-label={`Change ${l.role.toLowerCase()}`} className="rounded-lg p-2 text-dim transition-colors hover:bg-white/5 hover:text-fg">
                            <Pencil className="size-4" />
                          </button>
                        </motion.li>
                      ))}
                    </ul>
                    <div className="rounded-2xl border border-line bg-ink-950/40 p-5">
                      <Totals subtotal={subtotal} discount={discount} percent={setupDiscountPercent} complete={complete} large />
                      <Button className="mt-6 w-full" size="lg" onClick={addSetup} disabled={!lines.length} icon={added ? <Check className="size-4" /> : <ShoppingBag className="size-4" />}>
                        {added ? "Added to cart" : "Add setup to cart"}
                      </Button>
                      <p className="mt-3 text-center text-xs text-dim">Shipping and the setup discount are confirmed at checkout.</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button type="button" onClick={() => go(step - 1)} disabled={step === 0} className="inline-flex h-12 items-center gap-2 rounded-full border border-line px-5 text-sm font-medium transition-colors hover:border-line-strong disabled:pointer-events-none disabled:opacity-0">
            <ArrowLeft className="size-4" /> Back
          </button>
          {!last && (
            <div className="ml-auto flex items-center gap-5">
              <div className="hidden text-right sm:block">
                <Totals subtotal={subtotal} discount={discount} percent={setupDiscountPercent} complete={complete} />
              </div>
              <Button size="lg" onClick={() => go(step + 1)} disabled={!canContinue} icon={<ArrowRight className="size-4" />}>
                {step === STEPS.length - 2 ? "Review setup" : "Continue"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ───────────── pieces ───────────── */

function Progress({ step, canJump, onJump }: { step: number; canJump: (i: number) => boolean; onJump: (i: number) => void }) {
  return (
    <nav aria-label="Setup steps">
      <div className="relative h-1 overflow-hidden rounded-full bg-line">
        <motion.div className="absolute inset-y-0 left-0 rounded-full bg-brand" initial={false} animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }} transition={{ duration: 0.6, ease: EASE_EXPO }} />
      </div>
      <ol className="mt-4 grid grid-cols-6 gap-2">
        {STEPS.map((s, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={s.id}>
              <button
                type="button"
                disabled={!canJump(i)}
                onClick={() => onJump(i)}
                aria-current={current ? "step" : undefined}
                className={cn("flex w-full items-center gap-2 text-left text-xs transition-colors disabled:cursor-default", current ? "text-fg" : done ? "text-muted hover:text-fg" : "text-dim")}
              >
                <span className={cn("grid size-6 shrink-0 place-items-center rounded-full border font-mono text-[10px] transition-colors", current ? "border-blaze bg-blaze text-white" : done ? "border-blaze/60 text-blaze" : "border-line")}>
                  {done ? <Check className="size-3" strokeWidth={3} /> : i + 1}
                </span>
                <span className="hidden truncate md:inline">{s.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Totals({ subtotal, discount, percent, complete, large }: { subtotal: number; discount: number; percent: number; complete: boolean; large?: boolean }) {
  return (
    <div className={cn(large && "space-y-2 text-sm")}>
      {large && (
        <div className="flex justify-between">
          <span className="text-muted">Subtotal</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
      )}
      {complete ? (
        <div className={cn("text-ok", large ? "flex justify-between" : "text-xs")}>
          <span>Setup discount ({percent}%)</span>
          <span>{large ? `−${formatPrice(discount)}` : ` −${formatPrice(discount)}`}</span>
        </div>
      ) : (
        percent > 0 && <p className="text-xs text-dim">Add a card, fuser and input device for {percent}% off</p>
      )}
      <div className={cn(large ? "flex items-baseline justify-between border-t border-line pt-3" : "font-display text-2xl")}>
        {large && <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Total</span>}
        <span className={cn(large && "font-display text-3xl")}>{formatPrice(subtotal - discount)}</span>
      </div>
    </div>
  );
}

function Choices({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </div>
  );
}

const cardClass = (selected: boolean, disabled?: boolean) =>
  cn(
    "group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border bg-ink-950/50 text-left transition-[border-color,box-shadow,background-color] duration-300 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blaze",
    selected ? "border-blaze bg-blaze/[0.06] shadow-[0_0_0_1px_rgb(255_61_0/0.6),0_18px_50px_-24px_rgb(255_61_0/0.7)]" : "border-line hover:border-line-strong",
    disabled && "pointer-events-none opacity-50",
  );

function SelectedMark({ on }: { on: boolean }) {
  return (
    <AnimatePresence>
      {on && (
        <motion.span initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 520, damping: 28 }} className="absolute right-3 top-3 z-10 grid size-7 place-items-center rounded-full bg-blaze text-white shadow-lg">
          <Check className="size-4" strokeWidth={3} />
        </motion.span>
      )}
    </AnimatePresence>
  );
}

function ProductChoice({ name, product: p, selected, onSelect, multiple, kicker, children }: { name: string; product: Product; selected: boolean; onSelect: () => void; multiple?: boolean; kicker?: string; children?: ReactNode }) {
  const soldOut = p.status === "sold-out";
  // Option buttons sit beside the label, not inside it: a label may only contain its own control.
  return (
    <motion.div whileTap={soldOut ? undefined : { scale: 0.985 }} className={cardClass(selected, soldOut)}>
      <label className="flex flex-1 cursor-pointer flex-col">
        <input type={multiple ? "checkbox" : "radio"} name={name} checked={selected} onChange={onSelect} disabled={soldOut} className="sr-only" />
        <SelectedMark on={selected} />
        <span className="relative block aspect-video overflow-hidden bg-ink-950">
          <ProductVisual visual={p.visual} variant="card" sizes="(min-width: 1024px) 320px, (min-width: 640px) 50vw, 100vw" />
        </span>
        <span className="flex flex-1 flex-col gap-1 px-4 pt-4">
          {kicker && <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-blaze">{kicker}</span>}
          <span className="flex items-baseline justify-between gap-3">
            <span className="font-medium">{p.name}</span>
            <span className="shrink-0 font-mono text-sm">{formatPrice(p.price)}</span>
          </span>
          <span className="text-sm text-muted">{p.tagline}</span>
          {soldOut && <span className="text-xs text-ember">Sold out</span>}
        </span>
      </label>
      <div className="px-4 pb-4">{children}</div>
    </motion.div>
  );
}

function PlainChoice({ name, selected, onSelect, title, sub, disabled }: { name: string; selected: boolean; onSelect: () => void; title: string; sub?: string; disabled?: boolean }) {
  return (
    <motion.label whileTap={disabled ? undefined : { scale: 0.985 }} className={cn(cardClass(selected, disabled), "justify-center p-5")}>
      <input type="radio" name={name} checked={selected} onChange={onSelect} disabled={disabled} className="sr-only" />
      <SelectedMark on={selected} />
      <span className="font-medium">{title}</span>
      {sub && <span className="mt-1 text-sm text-muted">{sub}</span>}
    </motion.label>
  );
}

function ProductPreview({ product: p, caption }: { product: Product; caption: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-blaze/50 bg-ink-950/60">
      <div className="relative aspect-video">
        <ProductVisual visual={p.visual} variant="stage" sizes="(min-width: 1024px) 420px, 100vw" />
      </div>
      <div className="flex items-baseline justify-between gap-3 p-4">
        <div>
          <p className="font-medium">{p.name}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ok">
            <Check className="size-3.5" strokeWidth={3} /> {caption}
          </p>
        </div>
        <span className="font-mono text-sm">{formatPrice(p.price)}</span>
      </div>
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-2xl border border-line bg-ink-950/40 p-5 text-sm text-muted">
      <Info className="mt-0.5 size-4 shrink-0 text-blaze" />
      {children}
    </p>
  );
}

function PillGroup({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div role="radiogroup" aria-label={label} className={className}>
      <p className="mb-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-dim">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Pill({ name, checked, onChange, disabled, children }: { name: string; checked: boolean; onChange: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <label
      className={cn(
        "relative cursor-pointer rounded-full border px-4 py-2 font-mono text-xs tracking-[0.06em] transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blaze",
        checked ? "border-blaze text-white" : "border-line text-muted hover:border-line-strong hover:text-fg",
        disabled && "pointer-events-none opacity-35",
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} disabled={disabled} className="sr-only" />
      {checked && <motion.span layoutId={`pill-${name}`} className="absolute inset-0 -z-0 rounded-full bg-blaze" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
      <span className="relative">{children}</span>
    </label>
  );
}

function OptionPicker({ name, values, value, onChange }: { name: string; values: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div role="group" aria-label={name} className="mt-3 flex flex-wrap items-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-dim">{name}</span>
      {values.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={v === value}
          className={cn("rounded-full border px-3 py-1 text-xs transition-colors", v === value ? "border-blaze bg-blaze/15 text-fg" : "border-line text-muted hover:text-fg")}
        >
          {v}
        </button>
      ))}
    </div>
  );
}
