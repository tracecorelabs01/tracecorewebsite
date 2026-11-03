// Runs before `next build` (npm run build). The build prerenders pages from the database, so the database must
// have every column and row the new code reads before the build starts: apply the migrations in drizzle/, then the
// pending content patches in content/patches/. A build without DATABASE_URL has nothing to apply.
// Exits non-zero on failure, so a broken database never ships code that reads columns it doesn't have.
//   node scripts/predeploy.mjs
//
// Plain Node ESM using runtime dependencies only (drizzle-orm, mysql2): the host installs and builds, nothing else.

import { existsSync } from "node:fs";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { applyContentPatches } from "../src/lib/content-patches.mjs";

// `next build` reads these env files (first one wins), so a local build migrates the same database it's about to read.
for (const file of [".env.production.local", ".env.local", ".env.production", ".env"]) {
  if (existsSync(file)) process.loadEnvFile?.(file);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("[predeploy] DATABASE_URL is not set: no database to migrate or patch.");
  process.exit(0);
}

// The same connection settings as src/db/client.ts (MariaDB in production, MySQL locally): UTC, utf8mb4, optional TLS.
const ssl = process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" } : undefined;
const pool = mysql.createPool({ uri: url, connectionLimit: 2, charset: "utf8mb4", timezone: "Z", ssl });
pool.pool.on("connection", (conn) => {
  conn.query("SET time_zone = '+00:00'");
});

try {
  await migrate(drizzle({ client: pool }), { migrationsFolder: "drizzle" });
  console.log("[predeploy] database schema is up to date");
  const applied = await applyContentPatches(pool);
  console.log(applied.length ? `[predeploy] applied ${applied.length} content patch(es): ${applied.join(", ")}` : "[predeploy] no pending content patches");
} catch (err) {
  console.error("[predeploy] failed:", err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
