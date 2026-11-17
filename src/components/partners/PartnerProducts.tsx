"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { saveCustomerDiscount } from "@/actions/partner";
import { Status, Submit } from "@/components/account/AccountForms";
import { commissionLabel, percentLabel } from "@/lib/affiliate-labels";
import { customerPrice, discountStops, earnsPerUnit, type Commission } from "@/lib/affiliate-terms";
import { formatPrice } from "@/lib/utils";
import { CopyText } from "./PartnerForms";

export type PartnerProduct = { productId: number; slug: string; name: string; regularCents: number; floorCents: number; commission: Commission; thumb: ReactNode };

const panel = "rounded-3xl border border-line bg-ink-900/60 p-6 md:p-7";

/**
 * The partner's customer discount and what it does to each product: a slider from no discount to the most the
 * team allows, with every price and commission below following it before it's saved.
 */
export function PartnerProducts({ products, discount, linkBase, token }: { products: PartnerProduct[]; discount: number | null; linkBase: string; /** The random text in their links. */ token: string }) {
  const stops = discountStops(products);
  const last = stops.length - 1;
  // The top stop is saved as "the biggest allowed" (null), so it follows the limit if the team changes it.
  const initial = discount == null || discount >= stops[last] ? last : Math.max(0, stops.filter((s) => s <= discount).length - 1);
  const [index, setIndex] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const chosen = index >= last ? null : stops[index];

  const save = (e: FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await saveCustomerDiscount(chosen);
      setResult(res);
      if (res.ok) setSaved(index);
    });
  };

  return (
    // grid-cols-1 (here and on the list): lets the panels shrink to a phone's width instead of widening the page.
    <div className="grid grid-cols-1 gap-4">
      {last > 0 && (
        <form onSubmit={save} className={panel}>
          <h2 className="font-display text-2xl uppercase">Your customers&apos; discount</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            You choose how much people save with your link or code, up to {percentLabel(stops[last])}. Move the slider and the prices below show what they&apos;d pay and what you&apos;d earn.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-4">
            <p className="w-44 shrink-0 font-display text-6xl leading-none text-gradient">
              {percentLabel(stops[index])}
              <span className="ml-2 text-2xl">off</span>
            </p>
            <div className="min-w-56 flex-1">
              <input
                type="range"
                min={0}
                max={last}
                step={1}
                value={index}
                onChange={(e) => {
                  setIndex(Number(e.target.value));
                  setResult(null);
                }}
                aria-label="Customer discount"
                aria-valuetext={`${percentLabel(stops[index])} off`}
                className="h-2 w-full cursor-pointer accent-[#ff3d00]"
              />
              <div className="mt-2 flex justify-between text-xs text-dim">
                <span>0%: regular prices</span>
                <span>{percentLabel(stops[last])}: the most we allow</span>
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            {result ? <Status state={result} /> : <p className="text-sm text-dim">{index === saved ? "This is what your customers get now." : "Not saved yet."}</p>}
            <Submit pending={pending} disabled={index === saved} className="ml-auto h-10 px-5 text-[11px]">
              Save discount
            </Submit>
          </div>
        </form>
      )}
      <section className={panel}>
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {products.map((t) => {
            const price = customerPrice(t.regularCents, t.floorCents, chosen);
            return (
              // Phones: photo beside the name, numbers across the full card. Wider: everything beside the photo.
              <li key={t.productId} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 rounded-2xl border border-line p-4 sm:items-start sm:gap-y-2">
                <div className="relative size-16 overflow-hidden rounded-xl border border-line bg-ink-850 sm:row-span-3 sm:size-20">{t.thumb}</div>
                <p className="font-display text-xl uppercase leading-tight">{t.name}</p>
                <dl className="col-span-2 grid grid-cols-3 gap-2 text-sm sm:col-span-1 sm:col-start-2">
                  <div>
                    <dt className="text-xs text-dim">Customers pay</dt>
                    <dd className="font-mono">
                      {formatPrice(price / 100)}
                      {/* On its own line: beside the price it runs into the next column on narrow cards. */}
                      {price < t.regularCents && <span className="block text-xs text-dim line-through">{formatPrice(t.regularCents / 100)}</span>}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-dim">Commission</dt>
                    <dd className="font-mono">{commissionLabel(t.commission)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-dim">You earn</dt>
                    <dd className="font-mono text-ok">{formatPrice(earnsPerUnit(t.commission, price) / 100)}</dd>
                  </div>
                </dl>
                <div className="col-span-2 sm:col-span-1 sm:col-start-2">
                  <CopyText text={`${linkBase}/product/${t.slug}?ref=${token}`} label="Copy product link" />
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
