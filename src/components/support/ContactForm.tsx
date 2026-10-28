"use client";

import { useActionState, useLayoutEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Loader2, Mail, Package, Send } from "lucide-react";
import { DiscordIcon } from "@/components/ui/icons";
import { EASE_EXPO, Reveal, spotlightHandler } from "@/components/ui/motion";
import { sendMessage, type FormState } from "@/actions/store";
import { useStoreSettings } from "@/components/layout/StoreSettings";

const topics = ["Order status", "Setup help", "Warranty claim", "Returns", "Wholesale", "Something else"];

export function SupportContent() {
  const settings = useStoreSettings();
  const channels = [
    { Icon: DiscordIcon, title: "Discord", text: "Fastest replies, 24/7 support.", href: settings.links.discord, cta: "Open Discord", external: true },
    { Icon: Mail, title: "Email", text: settings.supportEmail, href: `mailto:${settings.supportEmail}`, cta: "Send email", external: false },
    { Icon: Package, title: "Order help", text: "Have your order number ready.", href: "#contact", cta: "Use the form", external: false },
  ];
  return (
    <section className="container-x pb-28">
      <div className="grid gap-4 md:grid-cols-3">
        {channels.map(({ Icon, title, text, href, cta, external }, i) => (
          <Reveal key={title} delay={i * 0.07}>
            <a
              href={href}
              {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
              onPointerMove={spotlightHandler}
              className="spotlight border-flow group relative flex h-full flex-col gap-10 overflow-hidden rounded-3xl border border-line bg-ink-900 p-7 transition-colors hover:border-transparent"
            >
              <span className="grid size-12 place-items-center rounded-2xl bg-brand text-white transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110">
                <Icon className="size-6" />
              </span>
              <div>
                <h3 className="type-h3">{title}</h3>
                <p className="mt-1 text-sm text-muted">{text}</p>
                <span className="mt-5 inline-block font-mono text-[11px] uppercase tracking-[0.16em] text-blaze">{cta} →</span>
              </div>
            </a>
          </Reveal>
        ))}
      </div>

      <div id="contact" className="mt-16 grid scroll-mt-32 gap-12 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <h2 className="type-h2">
            Open a <span className="text-gradient">ticket</span>
          </h2>
          <p className="mt-4 text-muted">Tell us what&apos;s going on and we&apos;ll get back to you by email. Include your order number if it&apos;s about an order.</p>
        </div>
        <div className="lg:col-span-8">
          <ContactForm />
        </div>
      </div>
    </section>
  );
}

function ContactForm() {
  // Remounting the form (new key) resets the server action state.
  const [formKey, setFormKey] = useState(0);
  const sent = useRef(false);

  // If this route is hidden (Activity) after a successful send, start fresh next time.
  useLayoutEffect(() => {
    return () => {
      if (sent.current) {
        sent.current = false;
        setFormKey((k) => k + 1);
      }
    };
  }, []);

  return <ContactFormInner key={formKey} onSent={() => (sent.current = true)} onReset={() => setFormKey((k) => k + 1)} />;
}

function ContactFormInner({ onSent, onReset }: { onSent: () => void; onReset: () => void }) {
  const [state, formAction, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await sendMessage(prev, formData);
    if (result?.ok) onSent();
    return result;
  }, null);

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {state?.ok ? (
          <motion.div
            key="sent"
            className="flex flex-col items-center gap-5 rounded-3xl border border-line bg-ink-900 p-12 text-center"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: EASE_EXPO }}
          >
            <span className="grid size-16 place-items-center rounded-full bg-brand">
              <Check className="size-7 text-white" strokeWidth={3} />
            </span>
            <p className="font-display text-4xl uppercase">Message sent</p>
            <p className="max-w-sm text-muted">Thanks — we&apos;ll reply by email. For anything urgent, ping us on Discord.</p>
            <button type="button" onClick={onReset} className="font-mono text-[11px] uppercase tracking-[0.16em] text-blaze hover:text-fg">
              Send another
            </button>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            action={formAction}
            className="grid gap-4 rounded-3xl border border-line bg-ink-900/60 p-6 sm:grid-cols-2 md:p-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Input label="Name" name="name" autoComplete="name" required />
            <Input label="Email" name="email" type="email" autoComplete="email" required />
            <Input label="Order number (optional)" name="order" placeholder="TCL-XXXXXX" />
            <label>
              <span className="type-kicker text-dim">Topic</span>
              <select name="topic" defaultValue={topics[0]} className="mt-2 h-12 w-full rounded-xl border border-line-strong bg-ink-900 px-4 outline-none transition-colors focus:border-blaze">
                {topics.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="sm:col-span-2">
              <span className="type-kicker text-dim">Message</span>
              <textarea
                name="message"
                required
                minLength={10}
                rows={6}
                className="mt-2 w-full resize-y rounded-xl border border-line-strong bg-ink-900 px-4 py-3 outline-none transition-colors placeholder:text-dim focus:border-blaze"
                placeholder="How can we help?"
              />
            </label>
            <input name="company" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
            <div className="flex items-center justify-between gap-4 sm:col-span-2">
              <p className={`text-xs ${state && !state.ok ? "text-ember" : "text-dim"}`} aria-live="polite">
                {state && !state.ok ? state.message : "We usually reply within one business day."}
              </p>
              <button
                type="submit"
                disabled={pending}
                className="flex h-12 items-center gap-2.5 bg-brand px-7 text-[12px] font-semibold uppercase tracking-[0.16em] text-white transition-[filter] clip-slant [--slant:13px] hover:brightness-110 disabled:opacity-70"
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                {pending ? "Sending" : "Send message"}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

function Input({ label, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label>
      <span className="type-kicker text-dim">{label}</span>
      <input {...props} className="mt-2 h-12 w-full rounded-xl border border-line-strong bg-ink-900 px-4 outline-none transition-colors placeholder:text-dim focus:border-blaze" />
    </label>
  );
}
