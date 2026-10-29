"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Pure-CSS marquee (cheap: the compositor runs it, so it stays smooth while the page is busy). Make one copy of the children at least screen-wide. */
export function CssMarquee({
  children,
  duration = 40,
  reverse = false,
  pauseOnHover = true,
  className,
}: {
  children: ReactNode;
  duration?: number;
  reverse?: boolean;
  pauseOnHover?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("group flex overflow-hidden mask-fade-x", className)}>
      <div
        className={cn("flex w-max shrink-0 animate-marquee", pauseOnHover && "group-hover:[animation-play-state:paused]")}
        style={{ animationDuration: `${duration}s`, animationDirection: reverse ? "reverse" : "normal" }}
      >
        <div className="flex shrink-0">{children}</div>
        <div className="flex shrink-0" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}
