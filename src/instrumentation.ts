// Runs once when a Next.js server starts.

const SWEEP_EVERY_MS = 15 * 60_000;

export async function register() {
  // Node server only: not the edge runtime, and never during `next build` (it would write to the live database).
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build" || !process.env.DATABASE_URL) return;

  const { releaseExpiredOrders } = await import("@/lib/admin/expire-orders");
  const sweep = () =>
    releaseExpiredOrders()
      .then((n) => n && console.log(`[orders] released ${n} unpaid order(s) past their reservation time`))
      .catch((err) => console.error("[orders] reservation sweep failed", err));

  // ponytail: in-process timer, fine for a single Node process; switch to a cron calling a route if the app runs on several.
  setTimeout(sweep, 30_000).unref();
  setInterval(sweep, SWEEP_EVERY_MS).unref();
}
