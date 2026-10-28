// Applies the SQL migrations in /drizzle to DATABASE_URL.
//   npm run db:migrate

import { migrate } from "drizzle-orm/mysql2/migrator";
import { createDb, createPool } from "../../src/db/client";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("✗ DATABASE_URL is not set (add it to .env.local).");
    process.exit(1);
  }
  const pool = createPool(url);
  try {
    await migrate(createDb(pool), { migrationsFolder: "drizzle" });
    console.log("✓ Database is up to date.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("✗ Migration failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
