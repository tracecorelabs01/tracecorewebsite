"use client";

// The only interactive bits of rendered Markdown (src/components/content/Markdown.tsx): copying a code block and
// loading a YouTube video when it's clicked, so a guide page doesn't load YouTube until someone wants to watch.

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Play } from "lucide-react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // No clipboard access (an insecure page or a denied permission): the code can still be selected by hand.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : "Copy code"}
      className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full border border-line bg-ink-850/90 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted transition-colors hover:border-line-strong hover:text-fg"
    >
      {copied ? <Check className="size-3 text-ok" /> : <Copy className="size-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/** Click-to-load embed from youtube-nocookie.com. Until it's clicked: the thumbnail, and a plain link that works without JavaScript. */
export function YouTubeEmbed({ id, title }: { id: string; title?: string }) {
  const [playing, setPlaying] = useState(false);
  const name = title ?? "YouTube video";
  return (
    <figure className="mt-6">
      <div className="relative aspect-video overflow-hidden rounded-2xl border border-line bg-ink-900">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`}
            title={name}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            className="absolute inset-0 size-full"
          />
        ) : (
          <button type="button" onClick={() => setPlaying(true)} aria-label={`Play video: ${name}`} className="group absolute inset-0 grid place-items-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- a remote thumbnail; next/image would need i.ytimg.com in images.remotePatterns */}
            <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover opacity-75 transition-opacity group-hover:opacity-90" />
            <span className="relative grid size-16 place-items-center rounded-full bg-brand text-white shadow-[0_10px_30px_-8px_rgb(255_61_0/0.7)] transition-transform group-hover:scale-105">
              <Play className="size-6 translate-x-0.5 fill-current" />
            </span>
          </button>
        )}
      </div>
      <figcaption className="mt-2 text-xs text-dim">
        {title ? `${title} · ` : ""}
        <a href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-fg">
          Watch on YouTube
        </a>
      </figcaption>
    </figure>
  );
}
