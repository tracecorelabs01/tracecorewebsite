import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span role="img" aria-label={`${rating} out of 5 stars`} className={cn("inline-flex items-center gap-0.5", className)}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} aria-hidden className={cn("size-3.5", i < rating ? "fill-amber text-amber" : "text-line-strong")} />
      ))}
    </span>
  );
}
