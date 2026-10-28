// Creates (or resets) an admin account.
//   npm run admin:create -- --email you@example.com --name "Your Name" [--role owner|admin|staff]
// The password is prompted for (hidden). Pass --password only in automation.
//
// Can't reach the database from your computer (e.g. remote access disabled)?
// Add --sql to print an INSERT statement to paste into phpMyAdmin instead.

import { createInterface } from "node:readline";
import { eq } from "drizzle-orm";
import { createDb, createPool } from "../../src/db/client";
import { adminUsers } from "../../src/db/schema";
import { hashPassword, PASSWORD_MIN } from "../../src/lib/auth/password";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

function prompt(question: string, hidden = false) {
  return new Promise<string>((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
      out._writeToOutput = (s: string) => {
        if (s.includes(question)) out.output.write(s);
        else out.output.write("*".repeat(s.length));
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

const sqlString = (v: string) => `'${v.replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;

async function main() {
  const printSql = process.argv.includes("--sql");
  const url = process.env.DATABASE_URL;
  if (!url && !printSql) throw new Error("DATABASE_URL is not set (add it to .env.local), or use --sql to print an INSERT for phpMyAdmin.");

  const email = (arg("email") ?? (await prompt("Email: "))).toLowerCase();
  const name = arg("name") ?? (await prompt("Name: "));
  const role = (arg("role") ?? "owner") as "owner" | "admin" | "staff";
  const password = arg("password") ?? (await prompt(`Password (min ${PASSWORD_MIN} chars): `, true));

  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("That email doesn't look right.");
  if (!name) throw new Error("Name is required.");
  if (!["owner", "admin", "staff"].includes(role)) throw new Error("Role must be owner, admin or staff.");
  if (password.length < PASSWORD_MIN) throw new Error(`Password must be at least ${PASSWORD_MIN} characters.`);

  if (printSql) {
    const hash = await hashPassword(password);
    console.log("\n-- Paste into phpMyAdmin (SQL tab) on your TraceCoreLab database:");
    console.log(
      `INSERT INTO admin_users (email, name, role, password_hash) VALUES (${sqlString(email)}, ${sqlString(name)}, '${role}', '${hash}')\n` +
        `  ON DUPLICATE KEY UPDATE name = VALUES(name), role = VALUES(role), password_hash = VALUES(password_hash), is_active = 1;\n`,
    );
    return;
  }

  const pool = createPool(url!);
  try {
    const db = createDb(pool);
    const passwordHash = await hashPassword(password);
    const [existing] = await db.select({ id: adminUsers.id }).from(adminUsers).where(eq(adminUsers.email, email)).limit(1);
    if (existing) {
      await db.update(adminUsers).set({ name, role, passwordHash, isActive: true }).where(eq(adminUsers.id, existing.id));
      console.log(`✓ Updated ${email} (${role}). Password reset.`);
    } else {
      await db.insert(adminUsers).values({ email, name, role, passwordHash });
      console.log(`✓ Created ${role} account for ${email}. Sign in at /admin/login`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("✗", err instanceof Error ? err.message : err);
  process.exit(1);
});
