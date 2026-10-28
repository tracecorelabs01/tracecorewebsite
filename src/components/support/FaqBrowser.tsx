"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { faqGroups } from "@/data/faq";
import { Accordion } from "@/components/ui/bits";
import { Reveal } from "@/components/ui/motion";

export function FaqBrowser() {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return faqGroups;
    return faqGroups
      .map((g) => ({ ...g, items: g.items.filter((i) => i.q.toLowerCase().includes(q) || i.a.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length > 0);
  }, [query]);

  return (
    <section className="container-x pb-28">
      <div className="grid gap-12 lg:grid-cols-12">
        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-28">
            <label className="flex h-12 items-center gap-3 rounded-full border border-line-strong bg-ink-900 px-5 transition-colors focus-within:border-blaze">
              <Search className="size-4 text-dim" />
              <span className="sr-only">Search the FAQ</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search questions" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-dim" />
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="text-dim hover:text-fg">
                  <X className="size-4" />
                </button>
              )}
            </label>
            <nav className="mt-8 hidden flex-col gap-1 lg:flex" aria-label="FAQ sections">
              {faqGroups.map((g) => (
                <a key={g.id} href={`#${g.id}`} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-muted transition-colors hover:bg-white/[0.03] hover:text-fg">
                  <span className="h-px w-4 bg-line-strong transition-all group-hover:w-7 group-hover:bg-blaze" />
                  {g.label}
                </a>
              ))}
            </nav>
          </div>
        </aside>
        <div className="space-y-16 lg:col-span-8">
          {groups.map((g) => (
            <Reveal key={g.id}>
              <div id={g.id} className="scroll-mt-32">
                <h2 className="font-display text-4xl uppercase">{g.label}</h2>
                <Accordion className="mt-6" items={g.items} defaultOpen={query ? 0 : null} key={query ? `q-${query}` : "all"} />
              </div>
            </Reveal>
          ))}
          {groups.length === 0 && (
            <div className="rounded-3xl border border-dashed border-line-strong py-20 text-center">
              <p className="font-display text-3xl uppercase">No answers found</p>
              <p className="mt-2 text-muted">Try another word — or ask us directly on the support page.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
