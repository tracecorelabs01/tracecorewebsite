"use client";

import { useState } from "react";
import { Field, Input, Textarea } from "@/components/admin/forms";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

// SEO title and description inputs shared by the product, category and guide editors: live character counts
// against the ranges search engines display, the fallback used when a field is left empty, and a result preview.

const TITLE = { min: 50, max: 65 };
const DESCRIPTION = { min: 140, max: 160 };

function Count({ length, min, max }: { length: number; min: number; max: number }) {
  const tone = length === 0 ? "text-dim" : length < min || length > max ? "text-amber-400" : "text-emerald-400";
  return (
    <span className={cn("tabular-nums", tone)}>
      {length} / {min} to {max}
    </span>
  );
}

export function SeoFields({
  title,
  description,
  titleFallback,
  descriptionFallback,
  path,
  titleName = "seoTitle",
  descriptionName = "seoDescription",
}: {
  title: string | null | undefined;
  description: string | null | undefined;
  /** What the page uses when the field is empty (shown as the placeholder and in the preview). */
  titleFallback: string;
  descriptionFallback: string;
  /** The page's path, for the preview URL. */
  path: string;
  titleName?: string;
  descriptionName?: string;
}) {
  const [t, setT] = useState(title ?? "");
  const [d, setD] = useState(description ?? "");
  // One line: the storefront collapses whitespace the same way when it saves and renders.
  const shownTitle = (t.trim() || titleFallback).replace(/\s+/g, " ");
  const shownDescription = (d.trim() || descriptionFallback).replace(/\s+/g, " ");

  return (
    <div className="space-y-4">
      <Field label="SEO title" name={titleName} hint={<span className="flex flex-wrap justify-between gap-2"><span>Empty uses: {titleFallback}</span><Count length={t.trim().length} {...TITLE} /></span>}>
        <Input name={titleName} value={t} onChange={(e) => setT(e.target.value)} placeholder={titleFallback} maxLength={160} />
      </Field>
      <Field label="SEO description" name={descriptionName} hint={<span className="flex flex-wrap justify-between gap-2"><span>One line. Empty uses the text shown in the box.</span><Count length={d.trim().length} {...DESCRIPTION} /></span>}>
        <Textarea name={descriptionName} value={d} onChange={(e) => setD(e.target.value)} placeholder={descriptionFallback} rows={3} maxLength={320} />
      </Field>
      <div className="rounded-xl border border-line bg-ink-950 p-4 text-sm" aria-label="Search result preview">
        <p className="truncate text-xs text-dim">
          {site.domain}
          {path}
        </p>
        <p className="mt-1 truncate text-base text-[#8ab4f8]">
          {shownTitle} | {site.name}
        </p>
        <p className="mt-1 line-clamp-2 text-muted">{shownDescription}</p>
      </div>
    </div>
  );
}
