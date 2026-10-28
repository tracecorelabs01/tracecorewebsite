import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/brand/Logo";
import { LoginForm } from "@/components/admin/LoginForm";
import { isDbConfigured } from "@/db";
import { getCurrentAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in" };
export const instant = false;

export default function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden border-r border-line bg-ink-900 lg:block">
        <div className="absolute inset-0 bg-grid opacity-60 mask-radial" />
        <div className="absolute -left-1/4 top-1/4 size-[70%] rounded-full bg-[radial-gradient(circle,rgb(255_61_0/0.25),transparent_65%)]" />
        <div className="absolute right-[12%] top-[18%] h-[60%] w-[30%] skew-x-[-30deg] rounded-[32px] bg-gradient-to-b from-white/[0.04] to-transparent" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <LogoMark className="h-10" />
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-dim">TraceCoreLab</p>
            <h1 className="mt-3 font-display text-7xl uppercase leading-[0.9]">
              Lab
              <br />
              <span className="text-gradient">console.</span>
            </h1>
            <p className="mt-5 max-w-sm text-muted">Orders, products, inventory and customers — everything behind the store in one place.</p>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <Suspense fallback={<div className="h-80 w-full max-w-sm" />}>
          <LoginGate searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function LoginGate({ searchParams }: Pick<PageProps<"/admin/login">, "searchParams">) {
  const dbReady = isDbConfigured();
  if (dbReady && (await getCurrentAdmin())) redirect("/admin");
  const { next } = await searchParams;
  return <LoginForm next={typeof next === "string" ? next : undefined} dbReady={dbReady} />;
}
