import Link from "next/link";
import type { Metadata } from "next";
import { ChangePasswordForm } from "@/components/account/AccountForms";
import { AccountShell, Panel } from "@/components/account/AccountShell";
import { requireCustomer } from "@/lib/auth/customer";

export const metadata: Metadata = { title: "Change password", robots: { index: false } };
// Reads the session on every request.
export const instant = false;

export default async function PasswordPage() {
  await requireCustomer();
  return (
    <AccountShell
      title={
        <span>
          Change <span className="text-gradient">password.</span>
        </span>
      }
      description="Got a temporary password from us? Replace it with your own here."
    >
      <Panel className="max-w-3xl">
        <ChangePasswordForm />
      </Panel>
      <p className="mt-6 text-sm text-muted">
        <Link href="/account" className="text-fg underline-offset-4 hover:underline">
          Back to your account
        </Link>
      </p>
    </AccountShell>
  );
}
