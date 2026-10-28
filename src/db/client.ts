// Connection factory shared by the app (src/db/index.ts) and CLI scripts.
// No "server-only" import here so tsx scripts can use it.

import mysql from "mysql2/promise";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "./schema";

export type Database = MySql2Database<typeof schema>;

export function createPool(url: string) {
  const ssl = process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" } : undefined;
  const pool = mysql.createPool({
    uri: url,
    // Shared hosts cap connections per user; keep the pool small.
    connectionLimit: Number(process.env.DATABASE_POOL_SIZE ?? 5),
    maxIdle: 2,
    idleTimeout: 60_000,
    waitForConnections: true,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
    charset: "utf8mb4",
    timezone: "Z",
    ssl,
  });
  // Store and read every timestamp in UTC regardless of the server's zone.
  pool.pool.on("connection", (conn) => {
    conn.query("SET time_zone = '+00:00'");
  });
  return pool;
}

export function createDb(pool: mysql.Pool): Database {
  return drizzle({ client: pool, schema, mode: "default" });
}
