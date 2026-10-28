import Link from "next/link";
import type { Metadata } from "next";
import { changePassword, updateProfile } from "@/actions/admin/account";
import { ActionForm, Field, FormStatus, Input, SubmitButton } from "@/components/admin/forms";
import { RoleBadge } from "@/components/admin/settings/RoleBadge";
import { SessionsCard } from "@/components/admin/settings/SessionsCard";
import { Card, PageHeader } from "@/components/admin/ui";
import { PASSWORD_MIN } from "@/lib/auth/password";
import { hasRole, requireAdmin } from "@/lib/auth/session";
import { listActiveSessions } from "@/lib/auth/sessions-admin";

export const metadata: Metadata = { title: "Account" };
// Admin pages read the session and live data on every request.
export const instant = false;

export default async function AccountPage() {
  const user = await requireAdmin("staff");
  const sessions = await listActiveSessions(user.id);

  return (
    <>
      <PageHeader title="Account" description="Your profile, password and the browsers you're signed in on." />
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card title="Profile" description="Your name appears in the activity log; you sign in with your email.">
            <ActionForm action={updateProfile} showStatus={false} className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" name="name">
                <Input name="name" defaultValue={user.name} required maxLength={120} autoComplete="name" />
              </Field>
              <Field label="Email" name="email">
                <Input name="email" type="email" defaultValue={user.email} required maxLength={191} autoComplete="email" />
              </Field>
              <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                <span className="flex items-center gap-2 text-xs text-dim">
                  Role <RoleBadge role={user.role} />
                  {hasRole(user, "owner") ? (
                    <Link href="/admin/staff" className="text-muted underline-offset-2 hover:text-fg hover:underline">
                      Manage staff
                    </Link>
                  ) : (
                    "· only an owner can change roles"
                  )}
                </span>
                <FormStatus className="mt-0" />
                <SubmitButton variant="secondary" className="ml-auto" pendingText="Saving…">
                  Save profile
                </SubmitButton>
              </div>
            </ActionForm>
          </Card>

          <Card title="Change password" description="You'll stay signed in here; every other browser is signed out.">
            <ActionForm action={changePassword} resetOnSuccess showStatus={false} className="grid gap-4 sm:grid-cols-2">
              {/* Lets password managers file the new password under the right account. */}
              <input type="text" name="username" autoComplete="username" defaultValue={user.email} hidden readOnly />
              <Field label="Current password" name="currentPassword" className="sm:col-span-2">
                <Input name="currentPassword" type="password" required autoComplete="current-password" />
              </Field>
              <Field label="New password" name="newPassword" hint={`At least ${PASSWORD_MIN} characters.`}>
                <Input name="newPassword" type="password" required minLength={PASSWORD_MIN} autoComplete="new-password" />
              </Field>
              <Field label="Confirm new password" name="confirmPassword">
                <Input name="confirmPassword" type="password" required minLength={PASSWORD_MIN} autoComplete="new-password" />
              </Field>
              <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                <FormStatus className="mt-0" />
                <SubmitButton className="ml-auto" pendingText="Updating…">
                  Change password
                </SubmitButton>
              </div>
            </ActionForm>
          </Card>
        </div>

        <SessionsCard sessions={sessions} />
      </div>
    </>
  );
}
