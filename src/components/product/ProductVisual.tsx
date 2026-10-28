"use client";

import Image from "next/image";
import type { ProductVisual as Visual } from "@/lib/catalog/types";
import { cn } from "@/lib/utils";
import { ProductArt } from "./ProductArt";

/**
 * Renders a product's photo or its SVG render. `card` tilts the render into an
 * isometric pose that straightens on hover; `stage` is the large product-page
 * view; `thumb` is static (no trace animation) for small cart thumbnails.
 */
export function ProductVisual({
  visual,
  variant = "card",
  className,
  eager,
  sizes,
}: {
  visual: Visual;
  variant?: "card" | "stage" | "thumb";
  className?: string;
  /** Above-the-fold: preload and load eagerly (LCP). */
  eager?: boolean;
  sizes?: string;
}) {
  if (visual.kind === "image") {
    return (
      <Image
        src={visual.src}
        alt={visual.alt}
        fill
        preload={eager}
        loading={eager ? "eager" : undefined}
        sizes={sizes ?? (variant === "thumb" ? "96px" : variant === "stage" ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 100vw")}
        className={cn(
          "object-cover",
          variant === "card" && "transition-transform duration-[1.2s] ease-[var(--ease-expo)] group-hover:scale-[1.06]",
          className,
        )}
      />
    );
  }

  return (
    <div className={cn("absolute inset-0 flex items-center justify-center", className)}>
      <div
        className={cn(
          "aspect-[640/440] w-[94%]",
          variant === "card" &&
            "w-[116%] " +
            "[transform:perspective(1200px)_rotateX(26deg)_rotateZ(-8deg)] transition-transform duration-[1.2s] ease-[var(--ease-expo)] group-hover:[transform:perspective(1200px)_rotateX(10deg)_rotateZ(-3deg)_translateY(-10px)_scale(1.05)]",
          variant === "stage" && "w-[96%]",
          variant === "thumb" && "w-[118%] [transform:perspective(900px)_rotateX(20deg)_rotateZ(-8deg)]",
        )}
      >
        <ProductArt art={visual.art} animated={variant !== "thumb"} eager={eager} />
      </div>
    </div>
  );
}
