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
  // Content patches (content/patches) normally run in scripts/predeploy.mjs before the build. Running them here too
  // covers a build that had no database; applied patches are recorded, so this is a no-op otherwise.
  try {
    const [{ applyContentPatches }, { createPool }] = await Promise.all([import("@/lib/content-patches.mjs"), import("@/db/client")]);
    const pool = createPool(process.env.DATABASE_URL);
    await applyContentPatches(pool).finally(() => pool.end());
  } catch (err) {
    console.error("[content] applying content patches failed; run `node scripts/predeploy.mjs`", err);
  }
  const { importDiskUploads } = await import("@/lib/storage");
  await importDiskUploads().catch((err) => console.error("[storage] importing images from disk failed", err));

  const [{ releaseExpiredOrders }, { approveDueCommissions }] = await Promise.all([import("@/lib/admin/expire-orders"), import("@/lib/affiliates")]);
  const sweep = () => {
    releaseExpiredOrders()
      .then((n) => n && console.log(`[orders] released ${n} unpaid order(s) past their reservation time`))
      .catch((err) => console.error("[orders] reservation sweep failed", err));
    approveDueCommissions()
      .then((n) => n && console.log(`[affiliates] approved ${n} commission(s) past their hold period`))
      .catch((err) => console.error("[affiliates] commission approval failed", err));
  };

  // ponytail: in-process timer, fine for a single Node process; switch to a cron calling a route if the app runs on several.
  setTimeout(sweep, 30_000).unref();
  setInterval(sweep, SWEEP_EVERY_MS).unref();
}
