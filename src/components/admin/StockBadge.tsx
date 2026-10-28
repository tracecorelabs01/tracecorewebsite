import { Badge } from "./ui";

export function StockBadge({ trackInventory, allowBackorder, stockQty, lowStockThreshold }: { trackInventory: boolean; allowBackorder: boolean; stockQty: number; lowStockThreshold: number }) {
  if (!trackInventory) return <span className="text-xs text-dim">Not tracked</span>;
  if (stockQty <= 0) return <Badge className="normal-case" tone={allowBackorder ? "info" : "danger"}>{allowBackorder ? `Pre-order (${stockQty})` : "Sold out"}</Badge>;
  if (stockQty <= lowStockThreshold) return <Badge className="normal-case" tone="warn">{stockQty} left</Badge>;
  return <span className="font-mono text-sm tabular-nums text-fg/90">{stockQty}</span>;
}
