"use client";

import { useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, HelpCircle, Info, Pencil, RotateCcw, ShoppingBag, X } from "lucide-react";
import type { Product, ProductVisual as Visual } from "@/lib/catalog/types";
import { useStoreSettings } from "@/components/layout/StoreSettings";
import { ProductVisual } from "@/components/product/ProductVisual";
import { Kicker } from "@/components/ui/bits";
import { Button } from "@/components/ui/Button";
import { EASE_EXPO } from "@/components/ui/motion";
import { useCart } from "@/lib/cart-store";
import { FUSERS, SCREENS, SETUP_SLUGS, SPEEDS, TIERS, UNSURE_FUSER, fuserFor, isCompleteSetup, maxHzFor, type Resolution, type TierId } from "@/lib/setup-builder";
import { useUi } from "@/lib/ui-store";
import { cn, formatPrice } from "@/lib/utils";

const STEPS = [
  { label: "Budget", title: "What's your budget?", hint: "Pick a starting point. You can change anything before you buy." },
  { label: "Monitor", title: "What monitor do you use?", hint: "We'll include the fuser that suits it, so the picture just works." },
  { label: "Second PC", title: "Do you have a second computer?", hint: "Your DMA card connects to a second computer that runs its software. Any modern PC or laptop will do." },
  { label: "Input", title: "Do you need an input device?", hint: "It plugs in between your mouse and your main PC." },
  { label: "Your setup", title: "Here's your setup", hint: "Everything you need, matched to your answers. Add extras if you like, then add it all to your cart." },
] as const;

/** What each part does, in a sentence anyone can follow. */
const WHAT_IT_DOES: Record<string, string> = {
  card: "Goes into a free PCIe slot inside your main PC.",
  fuser: "Shows the picture from both computers on your one monitor.",
  pc: "A small second computer that runs the card's software.",
  input: "Plugs in between your mouse and your main PC.",
  "usb-c-data-cable": "A longer braided cable, so the card reaches your second computer.",
  "pcie-riser-kit": "Lets you mount the card where there's more room or airflow.",
  "thermal-kit": "Keeps the card cool in a cramped case.",
};

const INPUT_CHOICES: Record<string, { title: string; sub: string }> = {
  makcu: { title: "Compact", sub: "Small and affordable." },
  ferrum: { title: "Premium", sub: "Machined aluminium, plug-and-play." },
};

type Line = { key: string; role: string; step: number; product: Product; what: string };

export function SetupBuilder({ products }: { products: Product[] }) {
  const { setupDiscountPercent } = useStoreSettings();
  const add = useCart((s) => s.add);
  const openCart = useUi((s) => s.openCart);
  const reduce = useReducedMotion();

  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const fusers = Object.keys(FUSERS).flatMap((s) => bySlug.get(s) ?? []);
  const inputs = SETUP_SLUGS.inputs.flatMap((s) => bySlug.get(s) ?? []);
  const extraProducts = SETUP_SLUGS.extras.flatMap((s) => bySlug.get(s) ?? []);
  const miniPc = bySlug.get(SETUP_SLUGS.miniPc);
  const cheapestFuser = fusers.length ? Math.min(...fusers.map((f) => f.price)) : 0;

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [tier, setTier] = useState<TierId>();
  const [screen, setScreen] = useState<Resolution>("1080p");
  const [hz, setHz] = useState(144);
  const [unsure, setUnsure] = useState(false);
  const [secondPc, setSecondPc] = useState<"have" | "need">();
  const [input, setInput] = useState<string>();
  const [inputTouched, setInputTouched] = useState(false);
  const [extras, setExtras] = useState<string[]>([]);
  const [options, setOptions] = useState<Record<string, string>>({});
  const [added, setAdded] = useState(false);

  const tierDef = TIERS.find((t) => t.id === tier);
  const card = tierDef ? bySlug.get(tierDef.card) : undefined;
  const maxHz = maxHzFor(
    fusers.map((f) => f.slug),
    screen,
  );
  const fuser = unsure ? (bySlug.get(UNSURE_FUSER) ?? fuserFor(fusers, "1440p", 240)) : fuserFor(fusers, screen, hz);
  const inputProduct = input && input !== "none" ? bySlug.get(input) : undefined;
  const screenLabel = SCREENS.find((s) => s.id === screen)!.label;
  const speedLabel = SPEEDS.find((s) => s.hz === hz)?.label ?? `${hz} Hz`;

  const lines = [
    card && { key: "card", role: "DMA card", step: 0, product: card, what: WHAT_IT_DOES.card },
    fuser && { key: "fuser", role: "Video fuser", step: 1, product: fuser, what: WHAT_IT_DOES.fuser },
    secondPc === "need" && miniPc && { key: "pc", role: "Second PC", step: 2, product: miniPc, what: WHAT_IT_DOES.pc },
    inputProduct && { key: "input", role: "Input device", step: 3, product: inputProduct, what: WHAT_IT_DOES.input },
    ...extraProducts.filter((p) => extras.includes(p.slug)).map((p) => ({ key: p.slug, role: "Add-on", step: 4, product: p, what: WHAT_IT_DOES[p.slug] ?? p.tagline })),
  ].filter((l): l is Line => Boolean(l));
  const buyable = lines.filter((l) => l.product.status !== "sold-out");
  const subtotal = buyable.reduce((n, l) => n + l.product.price, 0);
  const complete = setupDiscountPercent > 0 && isCompleteSetup(buyable.map((l) => l.product.category));
  const discount = complete ? Math.round(subtotal * setupDiscountPercent) / 100 : 0;

  const canContinue = [Boolean(tier), Boolean(fuser), Boolean(secondPc), Boolean(input), buyable.length > 0][step];
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

  function chooseTier(id: TierId) {
    setTier(id);
    // Suggest the tier's input device until the customer picks one themselves.
    if (!inputTouched) setInput(TIERS.find((t) => t.id === id)!.input);
  }

  function chooseScreen(id: Resolution) {
    setScreen(id);
    // Keep the speed within what our fusers can drive on the new screen.
    const cap = maxHzFor(
      fusers.map((f) => f.slug),
      id,
    );
    if (hz > cap) setHz([...SPEEDS].reverse().find((s) => s.hz <= cap)?.hz ?? SPEEDS[0].hz);
  }

  function addSetup() {
    for (const l of buyable) add(l.product, 1, options[l.product.slug] ?? l.product.option?.values[0]);
    setAdded(true);
    openCart();
  }

  function startOver() {
    setTier(undefined);
    setScreen("1080p");
    setHz(144);
    setUnsure(false);
    setSecondPc(undefined);
    setInput(undefined);
    setInputTouched(false);
    setExtras([]);
    setOptions({});
    go(0);
  }

  const slide = {
    enter: (d: number) => ({ opacity: 0, x: reduce ? 0 : d * 56 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: reduce ? 0 : d * -56 }),
  };

  return (
    <section id="build" className="container-x scroll-mt-28 pb-28">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10">
          <Kicker>Setup builder</Kicker>
          <h2 className="type-h2 mt-5">
            {setupDiscountPercent > 0 ? (
              <>
                Configure your bundle,
                <br />
                <span className="text-gradient">save an extra {setupDiscountPercent}%.</span>
              </>
            ) : (
              <>
                Build your <span className="text-gradient">setup.</span>
              </>
            )}
          </h2>
          <p className="mt-4 max-w-2xl text-muted">
            {"Answer four quick questions and we'll put together a complete setup for you."}
            {setupDiscountPercent > 0 && ` Take the whole bundle and the extra ${setupDiscountPercent}% comes off automatically.`}
          </p>
        </header>
        <Progress step={step} onJump={go} />

        <div className="relative mt-8 overflow-hidden rounded-[28px] border border-line bg-ink-900/50 p-5 sm:p-8">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgb(255_61_0/0.12),transparent_55%)]" />
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div key={step} custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.45, ease: EASE_EXPO }} className="relative">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-blaze">
                {last ? "All done" : `Question ${step + 1} of ${STEPS.length - 1}`}
              </p>
              <h2 ref={focusHeading} tabIndex={-1} className="mt-2 font-display text-3xl uppercase outline-none sm:text-4xl">
                {STEPS[step].title}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-muted">{STEPS[step].hint}</p>

              <div className="mt-7">
                {step === 0 && (
                  <Choices label="Budget" className="lg:grid-cols-3">
                    {TIERS.map((t) => {
                      const tierCard = bySlug.get(t.card);
                      const from = (tierCard?.price ?? 0) + cheapestFuser + (bySlug.get(t.input)?.price ?? 0);
                      return (
                        <Choice
                          key={t.id}
                          name="tier"
                          selected={tier === t.id}
                          onSelect={() => chooseTier(t.id)}
                          disabled={!tierCard}
                          visual={tierCard?.visual}
                          badge={"popular" in t ? "Most popular" : undefined}
                          title={t.label}
                          sub={t.blurb}
                          footer={tierCard ? `Setups from ${formatPrice(from)}` : "Coming soon"}
                        />
                      );
                    })}
                  </Choices>
                )}

                {step === 1 && (
                  <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
                    <div className={cn("transition-opacity", unsure && "pointer-events-none opacity-40")} aria-disabled={unsure}>
                      <p className="mb-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-dim">Screen size</p>
                      <Choices label="Screen size" className="sm:grid-cols-2">
                        {SCREENS.map((s) => (
                          <Choice key={s.id} name="screen" selected={screen === s.id} onSelect={() => chooseScreen(s.id)} title={s.label} sub={s.detail} compact />
                        ))}
                      </Choices>
                      <p className="mb-2.5 mt-6 font-mono text-[11px] uppercase tracking-[0.14em] text-dim">Speed (refresh rate)</p>
                      <div role="radiogroup" aria-label="Speed" className="flex flex-wrap gap-2">
                        {SPEEDS.map((s) => (
                          <Speed key={s.hz} checked={hz === s.hz} disabled={s.hz > maxHz} onChange={() => setHz(s.hz)} label={s.label} detail={s.detail} />
                        ))}
                      </div>
                    </div>
                    <div aria-live="polite">
                      <button
                        type="button"
                        onClick={() => setUnsure((u) => !u)}
                        aria-pressed={unsure}
                        className={cn("mb-4 flex w-full items-center gap-3 rounded-2xl border p-4 text-left text-sm transition-colors", unsure ? "border-blaze bg-blaze/10 text-fg" : "border-line text-muted hover:border-line-strong hover:text-fg")}
                      >
                        <HelpCircle className="size-5 shrink-0 text-blaze" />
                        <span>
                          <span className="block font-medium text-fg">{"I'm not sure"}</span>
                          It is usually in the monitor&apos;s name, or in Windows under Settings › System › Display.
                        </span>
                      </button>
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.div key={fuser?.slug ?? "none"} initial={{ opacity: 0, y: reduce ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduce ? 0 : -12 }} transition={{ duration: 0.3, ease: EASE_EXPO }}>
                          {fuser ? (
                            <ProductPreview product={fuser} caption={unsure ? "Works with almost every monitor" : `Works with your ${screenLabel} ${speedLabel} monitor`} />
                          ) : (
                            <Note>{"None of our fusers drives that combination. Try a lower speed, or choose I'm not sure."}</Note>
                          )}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <Choices label="Second computer" className="sm:grid-cols-2">
                    <Choice name="pc" selected={secondPc === "have"} onSelect={() => setSecondPc("have")} title="Yes, I have one" sub="A spare PC or laptop." />
                    <Choice
                      name="pc"
                      selected={secondPc === "need"}
                      onSelect={() => setSecondPc("need")}
                      disabled={!miniPc || miniPc.status === "sold-out"}
                      visual={miniPc?.visual}
                      title="No, add one for me"
                      sub={miniPc ? `We'll include the ${miniPc.name}.` : "Our mini PC is coming soon."}
                      aside={miniPc && formatPrice(miniPc.price)}
                    />
                  </Choices>
                )}

                {step === 3 && (
                  <Choices label="Input device" className="lg:grid-cols-3">
                    {inputs.map((p) => (
                      <Choice
                        key={p.slug}
                        name="input"
                        selected={input === p.slug}
                        onSelect={() => {
                          setInput(p.slug);
                          setInputTouched(true);
                        }}
                        disabled={p.status === "sold-out"}
                        visual={p.visual}
                        badge={tierDef?.input === p.slug ? "Suggested" : undefined}
                        title={INPUT_CHOICES[p.slug]?.title ?? p.name}
                        sub={`${p.name}. ${INPUT_CHOICES[p.slug]?.sub ?? p.tagline}`}
                        aside={formatPrice(p.price)}
                      />
                    ))}
                    <Choice
                      name="input"
                      selected={input === "none"}
                      onSelect={() => {
                        setInput("none");
                        setInputTouched(true);
                      }}
                      title="No thanks"
                      sub="I already have one."
                    />
                  </Choices>
                )}

                {step === 4 && (
                  <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div>
                      <ul className="mb-5 flex flex-wrap gap-2 text-xs">
                        <Recap label="Budget" value={tierDef?.label} onEdit={() => go(0)} />
                        <Recap label="Monitor" value={unsure ? "Not sure" : `${screenLabel}, ${speedLabel}`} onEdit={() => go(1)} />
                        <Recap label="Second PC" value={secondPc === "need" ? "Included" : "Your own"} onEdit={() => go(2)} />
                        <Recap label="Input" value={inputProduct ? (INPUT_CHOICES[inputProduct.slug]?.title ?? inputProduct.name) : "None"} onEdit={() => go(3)} />
                      </ul>
                      <ul className="divide-y divide-line rounded-2xl border border-line bg-ink-950/40">
                        {lines.map((l, i) => (
                          <motion.li
                            key={l.key}
                            initial={{ opacity: 0, y: reduce ? 0 : 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: reduce ? 0 : 0.05 * i, duration: 0.35, ease: EASE_EXPO }}
                            className="flex gap-4 p-4"
                          >
                            <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg border border-line bg-ink-950">
                              <ProductVisual visual={l.product.visual} variant="thumb" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-dim">{l.role}</p>
                              <p className="font-medium">{l.product.name}</p>
                              <p className="text-sm text-muted">{l.what}</p>
                              {l.product.status === "sold-out" && <p className="text-xs text-ember">Sold out, not included</p>}
                              {l.product.option && l.product.option.values.length > 1 && (
                                <OptionPicker name={l.product.option.name} values={l.product.option.values} value={options[l.product.slug] ?? l.product.option.values[0]} onChange={(v) => setOptions((o) => ({ ...o, [l.product.slug]: v }))} />
                              )}
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-2">
                              <span className="font-mono text-sm">{formatPrice(l.product.price)}</span>
                              {l.step < 4 ? (
                                <button type="button" onClick={() => go(l.step)} aria-label={`Change ${l.role.toLowerCase()}`} className="rounded-lg p-1.5 text-dim transition-colors hover:bg-white/5 hover:text-fg">
                                  <Pencil className="size-4" />
                                </button>
                              ) : (
                                <button type="button" onClick={() => setExtras((x) => x.filter((s) => s !== l.key))} aria-label={`Remove ${l.product.name}`} className="rounded-lg p-1.5 text-dim transition-colors hover:bg-white/5 hover:text-fg">
                                  <X className="size-4" />
                                </button>
                              )}
                            </div>
                          </motion.li>
                        ))}
                      </ul>

                      {extraProducts.some((p) => !extras.includes(p.slug)) && (
                        <div className="mt-6">
                          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-dim">Popular add-ons</p>
                          <div className="grid gap-3 sm:grid-cols-3">
                            {extraProducts
                              .filter((p) => !extras.includes(p.slug))
                              .map((p) => (
                                <button
                                  key={p.slug}
                                  type="button"
                                  onClick={() => setExtras((x) => [...x, p.slug])}
                                  disabled={p.status === "sold-out"}
                                  className="group flex flex-col overflow-hidden rounded-xl border border-line bg-ink-950/40 text-left transition-colors hover:border-line-strong disabled:opacity-50"
                                >
                                  <span className="relative block aspect-video overflow-hidden">
                                    <ProductVisual visual={p.visual} variant="card" sizes="200px" />
                                  </span>
                                  <span className="flex items-center justify-between gap-2 p-3 text-sm">
                                    <span className="truncate">+ {p.name}</span>
                                    <span className="font-mono text-xs">{formatPrice(p.price)}</span>
                                  </span>
                                </button>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="h-fit rounded-2xl border border-line bg-ink-950/40 p-5 lg:sticky lg:top-24">
                      <Totals subtotal={subtotal} discount={discount} percent={setupDiscountPercent} complete={complete} large />
                      <Button className="mt-6 w-full" size="lg" onClick={addSetup} disabled={!buyable.length} icon={added ? <Check className="size-4" /> : <ShoppingBag className="size-4" />}>
                        {added ? "Added to cart" : "Add everything to cart"}
                      </Button>
                      <p className="mt-3 text-center text-xs text-dim">Shipping and the setup discount are confirmed at checkout.</p>
                      <button type="button" onClick={startOver} className="mx-auto mt-4 flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-fg">
                        <RotateCcw className="size-3.5" /> Start over
                      </button>
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
              {tier && (
                <div className="hidden text-right sm:block">
                  <Totals subtotal={subtotal} discount={discount} percent={setupDiscountPercent} complete={complete} />
                </div>
              )}
              <Button size="lg" onClick={() => go(step + 1)} disabled={!canContinue} icon={<ArrowRight className="size-4" />}>
                {step === STEPS.length - 2 ? "See my setup" : "Continue"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ───────────── pieces ───────────── */

function Progress({ step, onJump }: { step: number; onJump: (i: number) => void }) {
  return (
    <nav aria-label="Setup steps">
      <div className="relative h-1 overflow-hidden rounded-full bg-line">
        <motion.div className="absolute inset-y-0 left-0 rounded-full bg-brand" initial={false} animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }} transition={{ duration: 0.6, ease: EASE_EXPO }} />
      </div>
      <ol className="mt-4 grid grid-cols-5 gap-2">
        {STEPS.map((s, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={s.label}>
              <button
                type="button"
                disabled={!done}
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
        percent > 0 && <p className="text-xs text-dim">Get the card, fuser and input device together for {percent}% off</p>
      )}
      <div className={cn(large ? "flex items-baseline justify-between border-t border-line pt-3" : "font-display text-2xl")}>
        {large && <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Total</span>}
        <span className={cn(large && "font-display text-3xl")}>{formatPrice(subtotal - discount)}</span>
      </div>
    </div>
  );
}

function Choices({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid gap-4", className)}>
      {children}
    </div>
  );
}

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

function Choice({
  name,
  selected,
  onSelect,
  title,
  sub,
  aside,
  badge,
  footer,
  visual,
  disabled,
  compact,
}: {
  name: string;
  selected: boolean;
  onSelect: () => void;
  title: string;
  sub?: string;
  aside?: ReactNode;
  badge?: string;
  footer?: string;
  visual?: Visual;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <motion.label
      whileTap={disabled ? undefined : { scale: 0.985 }}
      className={cn(
        "group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border bg-ink-950/50 text-left transition-[border-color,box-shadow,background-color] duration-300 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blaze",
        selected ? "border-blaze bg-blaze/[0.06] shadow-[0_0_0_1px_rgb(255_61_0/0.6),0_18px_50px_-24px_rgb(255_61_0/0.7)]" : "border-line hover:border-line-strong",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <input type="radio" name={name} checked={selected} onChange={onSelect} disabled={disabled} className="sr-only" />
      <SelectedMark on={selected} />
      {visual && (
        <span className="relative block aspect-video overflow-hidden bg-ink-950">
          <ProductVisual visual={visual} variant="card" sizes="(min-width: 1024px) 320px, (min-width: 640px) 50vw, 100vw" />
        </span>
      )}
      <span className={cn("flex flex-1 flex-col gap-1", compact ? "p-4" : "p-5")}>
        {badge && <span className="mb-1 w-fit rounded-full bg-blaze px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white">{badge}</span>}
        <span className="flex items-baseline justify-between gap-3">
          <span className={cn("font-medium", !compact && "text-lg")}>{title}</span>
          {aside && <span className="shrink-0 font-mono text-sm">{aside}</span>}
        </span>
        {sub && <span className="text-sm text-muted">{sub}</span>}
        {footer && <span className="mt-auto pt-3 font-mono text-xs text-blaze">{footer}</span>}
      </span>
    </motion.label>
  );
}

function Speed({ checked, disabled, onChange, label, detail }: { checked: boolean; disabled: boolean; onChange: () => void; label: string; detail: string }) {
  return (
    <label
      className={cn(
        "relative flex min-w-24 cursor-pointer flex-col items-center rounded-xl border px-4 py-2.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blaze",
        checked ? "border-blaze text-white" : "border-line text-muted hover:border-line-strong hover:text-fg",
        disabled && "pointer-events-none opacity-35",
      )}
    >
      <input type="radio" name="speed" checked={checked} onChange={onChange} disabled={disabled} className="sr-only" />
      {checked && <motion.span layoutId="speed-pill" className="absolute inset-0 rounded-xl bg-blaze" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
      <span className="relative font-mono text-sm">{label}</span>
      <span className={cn("relative text-[11px]", checked ? "text-white/80" : "text-dim")}>{detail}</span>
    </label>
  );
}

function ProductPreview({ product: p, caption }: { product: Product; caption: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-blaze/50 bg-ink-950/60">
      <p className="px-4 pt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-dim">Your fuser</p>
      <div className="relative mt-3 aspect-video">
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

function Recap({ label, value, onEdit }: { label: string; value?: string; onEdit: () => void }) {
  return (
    <li>
      <button type="button" onClick={onEdit} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 transition-colors hover:border-line-strong">
        <span className="text-dim">{label}:</span> <span className="text-fg">{value ?? "–"}</span>
        <Pencil className="size-3 text-dim" />
      </button>
    </li>
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

function OptionPicker({ name, values, value, onChange }: { name: string; values: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div role="group" aria-label={name} className="mt-2 flex flex-wrap items-center gap-2">
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
