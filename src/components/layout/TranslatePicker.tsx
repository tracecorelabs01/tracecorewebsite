"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Globe } from "lucide-react";
import { EASE_EXPO } from "@/components/ui/motion";
import { cn } from "@/lib/utils";

// The site is written in English; this picker translates it in the visitor's browser with Google Translate.
// Google's script loads only once someone picks a language (or comes back with one picked): its "googtrans" cookie
// remembers the choice across pages. Search engines index the English pages, so this is for reading, not ranking.

/** Google Translate's codes ("iw" is its code for Hebrew), with each language's own name. */
const LANGUAGES = [
  ["ar", "العربية"],
  ["cs", "Čeština"],
  ["da", "Dansk"],
  ["de", "Deutsch"],
  ["el", "Ελληνικά"],
  ["es", "Español"],
  ["fr", "Français"],
  ["iw", "עברית"],
  ["it", "Italiano"],
  ["hu", "Magyar"],
  ["nl", "Nederlands"],
  ["no", "Norsk"],
  ["pl", "Polski"],
  ["pt", "Português"],
  ["ro", "Română"],
  ["fi", "Suomi"],
  ["sv", "Svenska"],
  ["tr", "Türkçe"],
  ["uk", "Українська"],
  ["ur", "اردو"],
  ["hi", "हिन्दी"],
  ["zh-CN", "中文"],
  ["ja", "日本語"],
  ["ko", "한국어"],
] as const;

const COOKIE = "googtrans";

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: { translate?: { TranslateElement: new (options: object, element: string) => unknown } };
  }
}

/** The language Google Translate is set to, from its cookie ("/en/de" means German), or "en". */
function currentLanguage() {
  const value = document.cookie.match(/(?:^|; )googtrans=([^;]*)/)?.[1];
  const lang = value ? decodeURIComponent(value).split("/")[2] : "";
  return lang && lang !== "en" ? lang : "en";
}

/** Google reads the cookie on the bare host and on the parent domain, so it's written (and cleared) on both. */
function setCookie(value: string | null) {
  const host = location.hostname;
  const domains = host.includes(".") && !/^\d+(\.\d+){3}$/.test(host) ? ["", `; domain=.${host.replace(/^www\./, "")}`] : [""];
  for (const domain of domains) {
    document.cookie = value === null ? `${COOKIE}=; path=/; max-age=0${domain}` : `${COOKIE}=${value}; path=/; max-age=31536000; samesite=lax${domain}`;
  }
}

function loadGoogle() {
  if (document.getElementById("google-translate-script")) return;
  const mount = document.createElement("div");
  mount.id = "google_translate_element";
  mount.hidden = true;
  document.body.appendChild(mount);
  window.googleTranslateElementInit = () => {
    const TranslateElement = window.google?.translate?.TranslateElement;
    if (TranslateElement) new TranslateElement({ pageLanguage: "en", includedLanguages: LANGUAGES.map(([c]) => c).join(","), autoDisplay: false }, "google_translate_element");
  };
  const script = document.createElement("script");
  script.id = "google-translate-script";
  script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
  script.async = true;
  document.body.appendChild(script);
}

/** `up` opens the list above the button (for the mobile menu's bottom bar). */
export function TranslatePicker({ className, up = false }: { className?: string; up?: boolean }) {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState("en");
  const ref = useRef<HTMLDivElement>(null);

  // A visitor who picked a language earlier gets the page translated again.
  useEffect(() => {
    const picked = currentLanguage();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads a cookie once after hydration
    setLang(picked);
    if (picked !== "en") loadGoogle();
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  function choose(code: string) {
    setOpen(false);
    if (code === lang) return;
    if (code === "en") {
      // Back to the original English: clear the choice and reload, which undoes Google's changes to the page.
      setCookie(null);
      location.reload();
      return;
    }
    setCookie(`/en/${code}`);
    setLang(code);
    const select = document.querySelector<HTMLSelectElement>(".goog-te-combo");
    if (select) {
      select.value = code;
      select.dispatchEvent(new Event("change"));
    } else loadGoogle();
  }

  const current = LANGUAGES.find(([c]) => c === lang)?.[1] ?? "English";

  return (
    <div ref={ref} className={cn("relative", className)} translate="no">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Language: ${current}`}
        title="Translate this page"
        className="grid size-11 place-items-center rounded-full text-muted transition-colors hover:bg-white/5 hover:text-fg"
      >
        <Globe className="size-5" strokeWidth={1.8} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: up ? 6 : -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: up ? 6 : -6 }}
            transition={{ duration: 0.25, ease: EASE_EXPO }}
            className={cn("absolute right-0 z-50 w-60", up ? "bottom-full mb-2" : "top-full mt-2", "overflow-hidden rounded-2xl border border-line bg-ink-950 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.9)]")}
          >
            <p className="border-b border-line px-4 py-3 text-xs text-dim">Translate this page (Google Translate)</p>
            <ul role="listbox" aria-label="Language" className="max-h-80 overflow-y-auto py-1" data-lenis-prevent>
              {[["en", "English"] as const, ...LANGUAGES].map(([code, name]) => (
                <li key={code} role="option" aria-selected={code === lang}>
                  <button
                    type="button"
                    lang={code === "iw" ? "he" : code}
                    onClick={() => choose(code)}
                    className={cn("flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-colors hover:bg-white/[0.05]", code === lang ? "text-fg" : "text-muted")}
                  >
                    {name}
                    {code === lang && <Check className="size-4 text-blaze" />}
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
