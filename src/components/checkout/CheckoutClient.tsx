"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, useTransition, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Bitcoin, Check, CreditCard, Info, Loader2, Lock, ShoppingBag, Tag, UserRound, Wallet, X } from "lucide-react";
import { confirmPayment, startPayment } from "@/actions/payment";
import { placeOrder, previewDiscount, previewSetupDiscount, type PlaceOrderResult } from "@/actions/store";
import { useStoreSettings } from "@/components/layout/StoreSettings";
import type { CheckoutDetails } from "@/lib/account";
import { ProductVisual } from "@/components/product/ProductVisual";
import { PaymentLogos, TrustBadges } from "@/components/ui/Badges";
import { ButtonLink } from "@/components/ui/Button";
import { EASE_EXPO } from "@/components/ui/motion";
import { selectSubtotal, useCart } from "@/lib/cart-store";
import { useUi } from "@/lib/ui-store";
import { cn, formatPrice } from "@/lib/utils";

const countries = ["United States", "Canada", "United Kingdom", "Germany", "France", "Netherlands", "Sweden", "Poland", "Australia", "India", "Other"];
const methods = [
  { id: "card", label: "Card", sub: "Debit or credit card", Icon: CreditCard },
  { id: "paypal", label: "PayPal", sub: "Pay with your PayPal balance or card", Icon: Wallet },
  { id: "crypto", label: "Crypto", sub: "BTC · ETH · USDT · LTC", Icon: Bitcoin },
] as const;

type PlacedOrder = Extract<PlaceOrderResult, { ok: true }>["order"];
type CartIssue = { slug: string; message: string; maxQty?: number };
/** Card payment through Razorpay after the order is placed: the window is opening, open, being confirmed, done, or closed unpaid. */
type PayState = "opening" | "open" | "confirming" | "paid" | "unpaid";

type RazorpayResponse = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
declare global {
  interface Window {
    Razorpay?: new (options: object) => { open(): void; on(event: "payment.failed", cb: (r: { error?: { description?: string } }) => void): void };
  }
}

/** Razorpay's Standard Checkout script, loaded the first time someone pays. */
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => {
      script.remove();
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

export function CheckoutClient({ demo, cardOnline, details }: { demo: boolean; cardOnline: boolean; details: CheckoutDetails | null }) {
  const hydrated = useUi((s) => s.hydrated);
  const lines = useCart((s) => s.lines);
  const subtotal = useCart(selectSubtotal);
  const clear = useCart((s) => s.clear);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const settings = useStoreSettings();
  const [method, setMethod] = useState<(typeof methods)[number]["id"]>("card");
  const [pending, startTransition] = useTransition();
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [issues, setIssues] = useState<CartIssue[]>([]);
  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState<{ code: string; cents: number } | null>(null);
  const [discountMsg, setDiscountMsg] = useState<string | null>(null);
  const [checkingCode, startCodeCheck] = useTransition();
  const [pay, setPay] = useState<{ state: PayState; error?: string }>({ state: "opening" });
  const resetOnHide = useRef(false);

  // Don't show a stale confirmation if the user navigates away and back.
  useLayoutEffect(() => {
    return () => {
      if (resetOnHide.current) {
        resetOnHide.current = false;
        setPlaced(null);
      }
    };
  }, []);

  const cartInput = lines.map((l) => ({ slug: l.slug, option: l.option, qty: l.qty }));
  const cartKey = JSON.stringify(cartInput);
  // The server decides whether the cart is a complete setup; a code replaces the setup discount.
  const [setupQuote, setSetupQuote] = useState<{ key: string; discount: { code: string; cents: number } | null } | null>(null);
  const checkSetup = !demo && hydrated && !discount && lines.length > 0;
  useEffect(() => {
    if (!checkSetup) return;
    let current = true;
    previewSetupDiscount(JSON.parse(cartKey)).then((d) => current && setSetupQuote({ key: cartKey, discount: d }));
    return () => {
      current = false;
    };
  }, [cartKey, checkSetup]);
  // Only trust a quote for the cart as it is now.
  const setupDiscount = checkSetup && setupQuote?.key === cartKey ? setupQuote.discount : null;
  const discountCents = (discount ?? setupDiscount)?.cents ?? 0;
  const shipping = subtotal >= settings.freeShippingThreshold || subtotal === 0 ? 0 : settings.flatShipping;
  const total = Math.max(0, subtotal - discountCents / 100) + shipping;

  function applyCode() {
    const value = code.trim();
    if (!value) return;
    setDiscountMsg(null);
    startCodeCheck(async () => {
      const res = await previewDiscount(value, cartInput);
      if (res.ok) {
        setDiscount({ code: res.code, cents: res.discountCents });
        setDiscountMsg(`${res.code} applied`);
      } else {
        setDiscount(null);
        setDiscountMsg(res.error);
      }
    });
  }

  async function payNow(order: PlacedOrder) {
    setPay({ state: "opening" });
    const [loaded, start] = await Promise.all([loadRazorpay(), startPayment(order.number, order.email)]);
    if (!start.ok) return setPay(start.paid ? { state: "paid" } : { state: "unpaid", error: start.error });
    if (!loaded || !window.Razorpay) return setPay({ state: "unpaid", error: "The secure payment window didn't load. Check your connection and try again." });

    let failure: string | undefined;
    const checkout = new window.Razorpay({
      key: start.keyId,
      order_id: start.razorpayOrderId,
      amount: start.amount,
      currency: start.currency,
      name: start.name,
      description: start.description,
      prefill: start.prefill,
      theme: { color: "#ff3d00" },
      handler: async (r: RazorpayResponse) => {
        setPay({ state: "confirming" });
        const res = await confirmPayment({ number: order.number, razorpayOrderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature });
        setPay(res.ok ? { state: "paid" } : { state: "unpaid", error: res.error });
      },
      modal: { ondismiss: () => setPay((p) => (p.state === "open" ? { state: "unpaid", error: failure } : p)) },
    });
    // Razorpay lets them retry inside its window; keep the last reason in case they close it.
    checkout.on("payment.failed", (r) => (failure = r.error?.description || "The payment didn't go through."));
    checkout.open();
    setPay({ state: "open" });
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const get = (k: string) => String(form.get(k) ?? "");
    setError(null);
    setFieldErrors({});
    setIssues([]);
    startTransition(async () => {
      const res = await placeOrder({
        email: get("email"),
        phone: get("phone") || undefined,
        firstName: get("firstName"),
        lastName: get("lastName"),
        address1: get("address1"),
        address2: get("address2") || undefined,
        city: get("city"),
        region: get("region") || undefined,
        postalCode: get("zip"),
        country: get("country"),
        paymentMethod: method,
        discountCode: discount?.code,
        note: get("note") || undefined,
        company: get("company"),
        lines: cartInput,
      });
      if (res.ok) {
        setPlaced(res.order);
        resetOnHide.current = true;
        clear();
        window.scrollTo({ top: 0 });
        if (res.order.payOnline) void payNow(res.order);
      } else {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        setIssues(res.cartIssues ?? []);
      }
    });
  }

  if (!hydrated) return <div className="container-x min-h-[60vh] pb-32" />;
  if (placed?.payOnline && pay.state !== "paid") return <PaymentStep order={placed} state={pay.state} error={pay.error} onPay={() => payNow(placed)} />;
  if (placed) return <Confirmation order={placed} />;

  if (lines.length === 0) {
    return (
      <div className="container-x flex min-h-[50vh] flex-col items-center justify-center gap-6 pb-32 text-center">
        <div className="grid size-20 place-items-center rounded-full border border-line-strong bg-ink-900">
          <ShoppingBag className="size-8 text-blaze" strokeWidth={1.5} />
        </div>
        <div>
          <p className="font-display text-4xl uppercase">Your cart is empty</p>
          <p className="mt-2 text-muted">Add something from the store to check out.</p>
        </div>
        <ButtonLink href="/shop">Browse the store</ButtonLink>
      </div>
    );
  }

  return (
    <div className="container-x pb-32">
      {demo && (
        <div className="mb-8 flex items-start gap-3 rounded-2xl border border-warn/30 bg-warn/[0.06] p-4 text-sm text-fg/85">
          <Info className="mt-0.5 size-4 shrink-0 text-warn" />
          <p>
            <span className="font-semibold">Demo checkout.</span> No database is connected, so orders aren&apos;t saved. Add <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">DATABASE_URL</code> to go live.
          </p>
        </div>
      )}

      <form onSubmit={submit} noValidate className="grid gap-10 lg:grid-cols-12">
        <div className="space-y-10 lg:col-span-7">
          <Fieldset step="01" title="Contact">
            {details && (
              <p className="flex items-center gap-2 text-sm text-muted sm:col-span-2">
                <UserRound className="size-4 shrink-0 text-blaze" />
                Signed in as {details.email}. Your saved details are filled in below.
              </p>
            )}
            <Field label="Email" name="email" type="email" autoComplete="email" required className="sm:col-span-2" defaultValue={details?.email} error={fieldErrors.email} />
            <Field label="Phone (optional)" name="phone" type="tel" autoComplete="tel" className="sm:col-span-2" defaultValue={details?.phone} error={fieldErrors.phone} />
          </Fieldset>

          <Fieldset step="02" title="Shipping">
            <Field label="First name" name="firstName" autoComplete="given-name" required defaultValue={details?.firstName} error={fieldErrors.firstName} />
            <Field label="Last name" name="lastName" autoComplete="family-name" required defaultValue={details?.lastName} error={fieldErrors.lastName} />
            <Field label="Address" name="address1" autoComplete="address-line1" required className="sm:col-span-2" defaultValue={details?.address1} error={fieldErrors.address1} />
            <Field label="Apartment, suite (optional)" name="address2" autoComplete="address-line2" className="sm:col-span-2" defaultValue={details?.address2} />
            <Field label="City" name="city" autoComplete="address-level2" required defaultValue={details?.city} error={fieldErrors.city} />
            <Field label="State / region (optional)" name="region" autoComplete="address-level1" defaultValue={details?.region} />
            <Field label="Postal code" name="zip" autoComplete="postal-code" required defaultValue={details?.postalCode} error={fieldErrors.postalCode} />
            <label>
              <span className="type-kicker text-dim">Country</span>
              <select
                name="country"
                required
                defaultValue={details && countries.includes(details.country) ? details.country : ""}
                className={cn("mt-2 h-12 w-full rounded-xl border bg-ink-900 px-4 text-fg outline-none transition-colors focus:border-blaze", fieldErrors.country ? "border-ember" : "border-line-strong")}
              >
                <option value="" disabled>
                  Select country
                </option>
                {countries.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              {fieldErrors.country && <span className="mt-1.5 block text-xs text-ember">{fieldErrors.country}</span>}
            </label>
            <label className="sm:col-span-2">
              <span className="type-kicker text-dim">Order note (optional)</span>
              <textarea name="note" rows={3} maxLength={1000} className="mt-2 w-full resize-y rounded-xl border border-line-strong bg-ink-900 px-4 py-3 text-fg outline-none transition-colors focus:border-blaze" />
            </label>
            <input name="company" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
          </Fieldset>

          <Fieldset step="03" title="Payment">
            <div className="grid gap-3 sm:col-span-2" role="radiogroup" aria-label="Payment method">
              {methods.filter((m) => m.id === "card" || settings.manualPayments[m.id]).map(({ id, label, sub, Icon }) => (
                <label
                  key={id}
                  className={cn(
                    "relative flex cursor-pointer items-center gap-4 rounded-2xl border p-4 transition-colors",
                    method === id ? "border-blaze bg-[#ff3d00]/[0.07]" : "border-line-strong hover:border-white/25",
                  )}
                >
                  <input type="radio" name="method" value={id} checked={method === id} onChange={() => setMethod(id)} className="sr-only" />
                  <span className={cn("grid size-11 place-items-center rounded-xl", method === id ? "bg-brand text-white" : "bg-ink-800 text-muted")}>
                    <Icon className="size-5" />
                  </span>
                  <span className="flex-1">
                    <span className="block font-medium">{label}</span>
                    <span className="text-sm text-dim">{id === "card" && cardOnline ? "Visa · Mastercard and more, paid securely through Razorpay" : sub}</span>
                  </span>
                  <span className={cn("grid size-5 place-items-center rounded-full border", method === id ? "border-blaze bg-blaze" : "border-line-strong")}>
                    {method === id && <Check className="size-3 text-white" strokeWidth={3} />}
                  </span>
                </label>
              ))}
              <p className="flex items-center gap-2 text-sm text-dim">
                <Lock className="size-3.5 shrink-0" />
                {method === "card" && cardOnline
                  ? "You'll pay by card in a secure Razorpay window as soon as you place your order. We never see your card details."
                  : "You'll receive secure payment instructions after placing your order. We never see your card details."}
              </p>
            </div>
          </Fieldset>
        </div>

        <aside className="lg:col-span-5">
          <div className="rounded-3xl border border-line bg-ink-900/80 p-6 lg:sticky lg:top-28">
            <h2 className="font-display text-3xl uppercase">Order summary</h2>
            <ul className="mt-6 divide-y divide-line">
              {lines.map((l) => {
                const issue = issues.find((i) => i.slug === l.slug);
                return (
                  <li key={l.key} className="py-4">
                    <div className="flex items-center gap-4">
                      <div className="relative size-16 shrink-0 overflow-hidden rounded-xl border border-line bg-ink-850">
                        <ProductVisual visual={l.visual} variant="thumb" />
                        <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-brand font-mono text-[10px] text-white">{l.qty}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{l.name}</div>
                        {l.option && <div className="text-xs text-dim">{l.option}</div>}
                      </div>
                      <div className="font-mono text-sm">{formatPrice(l.price * l.qty)}</div>
                    </div>
                    {issue && (
                      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-ember/40 bg-ember/10 px-3 py-2 text-xs">
                        <span className="flex items-center gap-2 text-fg">
                          <AlertTriangle className="size-3.5 text-ember" /> {issue.message}
                        </span>
                        {issue.maxQty ? (
                          <button
                            type="button"
                            onClick={() => {
                              setQty(l.key, issue.maxQty!);
                              setIssues((all) => all.filter((i) => i.slug !== l.slug));
                            }}
                            className="font-semibold text-blaze hover:text-fg"
                          >
                            Set to {issue.maxQty}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              remove(l.key);
                              setIssues((all) => all.filter((i) => i.slug !== l.slug));
                            }}
                            className="font-semibold text-blaze hover:text-fg"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="mt-2 border-t border-line pt-5">
              {discount ? (
                <div className="flex items-center justify-between rounded-xl border border-ok/30 bg-ok/10 px-4 py-3 text-sm">
                  <span className="flex items-center gap-2">
                    <Tag className="size-4 text-ok" /> <span className="font-mono">{discount.code}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setDiscount(null);
                      setDiscountMsg(null);
                      setCode("");
                    }}
                    aria-label="Remove discount"
                    className="text-muted hover:text-fg"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyCode();
                      }
                    }}
                    placeholder="Discount code"
                    aria-label="Discount code"
                    className="h-11 min-w-0 flex-1 rounded-xl border border-line-strong bg-ink-900 px-4 font-mono text-sm uppercase outline-none transition-colors placeholder:normal-case placeholder:text-dim focus:border-blaze"
                  />
                  <button type="button" onClick={applyCode} disabled={checkingCode || !code.trim()} className="h-11 rounded-xl border border-line-strong px-4 text-sm font-medium transition-colors hover:border-blaze disabled:opacity-50">
                    {checkingCode ? <Loader2 className="size-4 animate-spin" /> : "Apply"}
                  </button>
                </div>
              )}
              {discountMsg && !discount && <p className="mt-2 text-xs text-ember">{discountMsg}</p>}
            </div>

            <dl className="mt-5 space-y-2 border-t border-line pt-5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd>{formatPrice(subtotal)}</dd>
              </div>
              {(discount ?? setupDiscount) && (
                <div className="flex justify-between">
                  <dt className="text-muted">{discount ? "Discount" : `Setup discount (${settings.setupDiscountPercent}%)`}</dt>
                  <dd className="text-ok">−{formatPrice(discountCents / 100)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted">Shipping</dt>
                <dd>{shipping === 0 ? <span className="text-ok">Free</span> : formatPrice(shipping)}</dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-line pt-4">
                <dt className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Total</dt>
                <dd className="font-display text-4xl">{formatPrice(total)}</dd>
              </div>
            </dl>

            {error && (
              <p className="mt-5 flex items-start gap-2 rounded-xl border border-ember/40 bg-ember/10 px-4 py-3 text-sm text-fg" role="alert">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-ember" /> {error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="mt-6 flex h-14 w-full items-center justify-center gap-3 bg-brand text-[13px] font-semibold uppercase tracking-[0.16em] text-white transition-[filter] clip-slant [--slant:16px] hover:brightness-110 disabled:opacity-70"
            >
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Placing order
                </>
              ) : (
                <>
                  <Lock className="size-4" /> {method === "card" && cardOnline ? "Place order & pay" : "Place order"} · {formatPrice(total)}
                </>
              )}
            </button>
            <p className="mt-4 text-center text-xs text-dim">
              By placing your order you agree to our{" "}
              <Link href="/legal/terms" className="underline underline-offset-2 hover:text-fg">
                terms
              </Link>{" "}
              and{" "}
              <Link href="/legal/refunds" className="underline underline-offset-2 hover:text-fg">
                refund policy
              </Link>
              .
            </p>
            <div className="mt-5 space-y-4 border-t border-line pt-5">
              <PaymentLogos size="sm" className="justify-center" />
              <TrustBadges compact />
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
}

function Fieldset({ step, title, children }: { step: string; title: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-3xl border border-line bg-ink-900/50 p-6 md:p-8">
      <legend className="sr-only">{title}</legend>
      <div className="mb-6 flex items-center gap-4">
        <span className="font-display text-3xl text-gradient">{step}</span>
        <h2 className="font-display text-3xl uppercase">{title}</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Field({ label, className, error, ...props }: { label: string; className?: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={className}>
      <span className="type-kicker text-dim">{label}</span>
      <input
        {...props}
        aria-invalid={error ? true : undefined}
        className={cn(
          "mt-2 h-12 w-full rounded-xl border bg-ink-900 px-4 text-fg outline-none transition-colors placeholder:text-dim focus:border-blaze",
          error ? "border-ember" : "border-line-strong",
        )}
      />
      {error && <span className="mt-1.5 block text-xs text-ember">{error}</span>}
    </label>
  );
}

function Confirmation({ order }: { order: PlacedOrder }) {
  const { links } = useStoreSettings();
  return (
    <div className="container-x pb-32">
      <motion.div
        className="relative mx-auto max-w-2xl overflow-hidden rounded-[32px] border border-line bg-ink-900 p-8 text-center md:p-12"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: EASE_EXPO }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgb(255_61_0/0.22),transparent_60%)]" />
        <Burst />
        <motion.div
          className="relative mx-auto grid size-24 place-items-center rounded-full bg-brand shadow-[0_20px_60px_-10px_rgb(255_61_0/0.8)]"
          initial={{ scale: 0, rotate: -40 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.2 }}
        >
          <svg viewBox="0 0 24 24" className="size-11 text-white" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 0.55, ease: EASE_EXPO }} />
          </svg>
        </motion.div>
        <p className="relative mt-8 type-kicker text-blaze">Order {order.number}</p>
        <h2 className="relative mt-3 type-h2">Order received</h2>
        <p className="relative mx-auto mt-4 max-w-md text-muted">{order.note}</p>
        <p className="relative mt-3 text-sm text-dim">
          Confirmation sent to <span className="text-fg">{order.email}</span>
        </p>
        {order.demo && <p className="relative mt-3 text-xs text-warn">Demo order — not saved (no database connected).</p>}
        {!order.demo && (
          <p className="relative mx-auto mt-5 max-w-md rounded-2xl border border-line bg-ink-950/50 px-5 py-4 text-sm text-muted">
            {order.payOnline ? "Your payment is confirmed, so you can" : "Once your payment is confirmed,"}{" "}
            <Link href={`/account/activate?${new URLSearchParams({ email: order.email, order: order.number })}`} className="text-fg underline-offset-4 hover:underline">
              open your account
            </Link>{" "}
            with this order number to track your orders and earn loyalty points.
          </p>
        )}
        <ul className="relative mt-8 divide-y divide-line rounded-2xl border border-line text-left">
          {order.lines.map((l, i) => (
            <li key={i} className="flex justify-between gap-4 px-5 py-3 text-sm">
              <span>
                {l.qty} × {l.name}
                {l.option ? <span className="text-dim"> · {l.option}</span> : null}
              </span>
              <span className="font-mono">{formatPrice(l.lineTotalCents / 100)}</span>
            </li>
          ))}
          {order.discountCents > 0 && (
            <li className="flex justify-between px-5 py-3 text-sm">
              <span className="text-muted">Discount</span>
              <span className="font-mono text-ok">−{formatPrice(order.discountCents / 100)}</span>
            </li>
          )}
          <li className="flex justify-between px-5 py-3 text-sm">
            <span className="text-muted">Shipping</span>
            <span className="font-mono">{order.shippingCents ? formatPrice(order.shippingCents / 100) : "Free"}</span>
          </li>
          <li className="flex justify-between px-5 py-3">
            <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Total</span>
            <span className="font-display text-2xl">{formatPrice(order.totalCents / 100)}</span>
          </li>
        </ul>
        <div className="relative mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/shop">Keep shopping</ButtonLink>
          <ButtonLink href={links.discord} target="_blank" rel="noreferrer" variant="ghost">
            Join Discord
          </ButtonLink>
        </div>
      </motion.div>
    </div>
  );
}

/** Between placing a card order and Razorpay confirming it: progress, or why it isn't paid yet with a way to pay. */
function PaymentStep({ order, state, error, onPay }: { order: PlacedOrder; state: PayState; error?: string; onPay: () => void }) {
  const busy = state !== "unpaid";
  const title = state === "confirming" ? "Confirming payment" : busy ? "Complete your payment" : "Payment not completed";
  const text =
    state === "confirming"
      ? "Hold on while we confirm your payment."
      : busy
        ? "Finish paying in the secure Razorpay window."
        : "Your order is saved and its items are held for you. Pay now to confirm it.";
  return (
    <div className="container-x pb-32">
      <div className="relative mx-auto max-w-2xl overflow-hidden rounded-[32px] border border-line bg-ink-900 p-8 text-center md:p-12">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgb(255_61_0/0.14),transparent_60%)]" />
        <div className="relative mx-auto grid size-20 place-items-center rounded-full border border-line-strong bg-ink-950">
          {busy ? <Loader2 className="size-8 animate-spin text-blaze" /> : <CreditCard className="size-8 text-blaze" />}
        </div>
        <p className="relative mt-8 type-kicker text-blaze">Order {order.number}</p>
        <h2 className="relative mt-3 type-h2">{title}</h2>
        <p className="relative mx-auto mt-4 max-w-md text-muted">{text}</p>
        {!busy && error && (
          <p role="alert" className="relative mx-auto mt-5 flex max-w-md items-start gap-2 rounded-xl border border-ember/40 bg-ember/10 px-4 py-3 text-left text-sm text-fg">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-ember" /> {error}
          </p>
        )}
        {!busy && (
          <button
            type="button"
            onClick={onPay}
            className="relative mx-auto mt-8 flex h-14 items-center justify-center gap-3 bg-brand px-10 text-[13px] font-semibold uppercase tracking-[0.16em] text-white transition-[filter] clip-slant [--slant:16px] hover:brightness-110"
          >
            <Lock className="size-4" /> Pay {formatPrice(order.totalCents / 100)}
          </button>
        )}
        <p className="relative mt-8 flex items-center justify-center gap-2 text-xs text-dim">
          <Lock className="size-3.5 shrink-0" /> Card payments are processed by Razorpay. We never see your card details.
        </p>
        <p className="relative mt-2 text-xs text-dim">
          Need help?{" "}
          <Link href="/support" className="underline underline-offset-2 hover:text-fg">
            Contact us
          </Link>{" "}
          with your order number.
        </p>
      </div>
    </div>
  );
}

/** One-shot confetti of brand-coloured slants. */
function Burst() {
  const bits = Array.from({ length: 26 }, (_, i) => {
    const a = (i / 26) * Math.PI * 2;
    const d = 140 + (i % 5) * 34;
    return { x: Math.cos(a) * d, y: Math.sin(a) * d * 0.7, r: (i * 47) % 360, c: ["#ff1408", "#ff3d00", "#ff7a00", "#d9dadc"][i % 4] };
  });
  return (
    <AnimatePresence>
      <div className="pointer-events-none absolute left-1/2 top-[88px] md:top-[100px]" aria-hidden>
        {bits.map((b, i) => (
          <motion.span
            key={i}
            className="absolute h-2 w-4 -translate-x-1/2 -translate-y-1/2 skew-x-[-30deg] rounded-[2px]"
            style={{ backgroundColor: b.c }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.4 }}
            animate={{ x: b.x, y: b.y + 60, opacity: 0, rotate: b.r, scale: 1 }}
            transition={{ duration: 1.6, ease: [0.2, 0.8, 0.3, 1], delay: 0.35 }}
          />
        ))}
      </div>
    </AnimatePresence>
  );
}
