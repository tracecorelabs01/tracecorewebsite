import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Kicker } from "@/components/ui/bits";
import { categoryTiles } from "@/data/home";

/** "Shop by category": one server-rendered tile per product family, each linking only its own category and guide. */
export function CategoryTiles({ counts }: { counts: Record<string, number> }) {
  const tiles = categoryTiles.filter((t) => (counts[t.category] ?? 0) > 0);
  if (!tiles.length) return null;
  return (
    <section className="container-x py-20 md:py-28" aria-labelledby="categories-heading">
      <Kicker>Shop by category</Kicker>
      <h2 id="categories-heading" className="type-h2 mt-5">
        What we <span className="text-gradient">sell</span>
      </h2>
      <ul className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tiles.map((t) => (
          <li key={t.category} className="flex flex-col rounded-3xl border border-line bg-ink-900/60 p-6 md:p-8">
            <h3 className="font-display text-3xl uppercase">{t.title}</h3>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{t.text}</p>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
              {t.links.map((l) => (
                <Link key={l.href} href={l.href} className="group inline-flex items-center gap-1.5 text-sm text-fg transition-colors hover:text-blaze">
                  {l.label}
                  <ArrowUpRight className="size-3.5 text-dim transition-colors group-hover:text-blaze" />
                </Link>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
