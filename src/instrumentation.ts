// Runs once when a Next.js server starts.

const SWEEP_EVERY_MS = 15 * 60_000;

export async function register() {
  // Node server only: not the edge runtime, and never during `next build` (it would write to the live database).
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build" || !process.env.DATABASE_URL) return;

  // New tables ship with the code in /drizzle. Apply any this database doesn't have yet, so a deploy needs no
  // manual `npm run db:migrate`. Already-applied migrations are skipped (tracked in __drizzle_migrations).
  try {
    const [{ migrate }, { getDb }] = await Promise.all([import("drizzle-orm/mysql2/migrator"), import("@/db")]);
    await migrate(getDb(), { migrationsFolder: "drizzle" });
  } catch (err) {
    console.error("[db] applying migrations failed; run `npm run db:migrate`", err);
  }
  const { importDiskUploads } = await import("@/lib/storage");
  await importDiskUploads().catch((err) => console.error("[storage] importing images from disk failed", err));

  const { releaseExpiredOrders } = await import("@/lib/admin/expire-orders");
  const sweep = () =>
    releaseExpiredOrders()
      .then((n) => n && console.log(`[orders] released ${n} unpaid order(s) past their reservation time`))
      .catch((err) => console.error("[orders] reservation sweep failed", err));

  // ponytail: in-process timer, fine for a single Node process; switch to a cron calling a route if the app runs on several.
  setTimeout(sweep, 30_000).unref();
  setInterval(sweep, SWEEP_EVERY_MS).unref();
}
