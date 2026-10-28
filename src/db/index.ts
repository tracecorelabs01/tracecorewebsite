import "server-only";
import type mysql from "mysql2/promise";
import { createDb, createPool, type Database } from "./client";

export * from "./schema";

/** True when a database is configured; without one the storefront runs on the static demo catalogue. */
export function isDbConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

// Reuse one pool across hot reloads in development.
const globalForDb = globalThis as unknown as { __tclPool?: mysql.Pool; __tclDb?: Database };

export function getDb(): Database {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Add it to .env.local (see .env.example).");
  if (!globalForDb.__tclDb) {
    globalForDb.__tclPool ??= createPool(url);
    globalForDb.__tclDb = createDb(globalForDb.__tclPool);
  }
  return globalForDb.__tclDb;
}
