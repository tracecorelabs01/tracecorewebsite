import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { Database } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { isDbConfigured } from "@/db";
import { getNavCounts } from "@/lib/admin/nav";
import { getCurrentAdmin } from "@/lib/auth/session";

// Every admin page reads the session; navigations are allowed to wait for it.
export const instant = false;

export default function PanelLayout({ children }: { children: ReactNode }) {
  if (!isDbConfigured()) return <DatabaseSetup />;
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <Gate>{children}</Gate>
    </Suspense>
  );
}

async function Gate({ children }: { children: ReactNode }) {
  const user = await getCurrentAdmin();
  if (!user) redirect("/admin/login");
  const counts = await getNavCounts();
  return (
    <AdminShell user={user} counts={counts}>
      {children}
    </AdminShell>
  );
}

function PanelSkeleton() {
  return (
    <div className="min-h-dvh lg:pl-64" aria-busy="true">
      <div className="fixed inset-y-0 left-0 hidden w-64 border-r border-line bg-ink-900 lg:block" />
      <div className="h-16 border-b border-line" />
      <div className="mx-auto max-w-7xl space-y-4 px-8 py-10">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-white/[0.05]" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border border-line bg-ink-900/70" />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-2xl border border-line bg-ink-900/70" />
      </div>
    </div>
  );
}

function DatabaseSetup() {
  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-lg rounded-3xl border border-line bg-ink-900/80 p-8">
        <div className="mb-5 grid size-12 place-items-center rounded-2xl bg-brand text-white">
          <Database className="size-6" />
        </div>
        <h1 className="font-display text-4xl uppercase">Connect your database</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">The admin console needs a MySQL database. Add your connection string to the environment, then create the tables and your first account:</p>
        <pre className="mt-5 overflow-x-auto rounded-xl border border-line bg-ink-950 p-4 font-mono text-xs leading-6 text-fg/90">
          {`# .env.local
DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/DB

npm run db:setup
npm run admin:create`}
        </pre>
        <p className="mt-4 text-xs text-dim">Until then the storefront runs on the built-in demo catalogue.</p>
      </div>
    </div>
  );
}
