import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { createStaff } from "@/actions/admin/staff";
import { ActionForm, Field, FormStatus, Input, Select, SubmitButton } from "@/components/admin/forms";
import { RoleBadge, RoleLegend } from "@/components/admin/settings/RoleBadge";
import { StaffControls } from "@/components/admin/settings/StaffControls";
import { Badge, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/admin/ui";
import { dateTime, param, shortDate } from "@/lib/admin/format";
import { listStaff, STAFF_BLOCKED, type StaffBlock } from "@/lib/admin/staff";
import { PASSWORD_MIN } from "@/lib/auth/password";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Staff" };
// Admin pages read the session and live data on every request.
export const instant = false;

export default async function StaffPage({ searchParams }: PageProps<"/admin/staff">) {
  const user = await requireAdmin("owner");
  const [members, sp] = await Promise.all([listStaff(), searchParams]);
  const blocked = param(sp.blocked);
  const notice = blocked && Object.hasOwn(STAFF_BLOCKED, blocked) ? STAFF_BLOCKED[blocked as StaffBlock] : null;
  const active = members.filter((m) => m.isActive).length;

  return (
    <>
      <PageHeader
        title="Staff"
        description={`${members.length} account${members.length === 1 ? "" : "s"} · ${active} active. Decide who can sign in to the lab console and what they can change.`}
      />
      {notice && (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm">
          <AlertTriangle className="size-4 shrink-0 text-warn" /> {notice}
        </p>
      )}

      <Card padded={false}>
        {members.length === 0 ? (
          <EmptyState icon={<ShieldCheck className="size-5" />} title="No staff accounts" description="Add a team member below." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Member</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Last login</Th>
                <Th>Added</Th>
                <Th className="w-[320px]">Manage</Th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const isYou = m.id === user.id;
                return (
                  <tr key={m.id} className="transition-colors hover:bg-white/[0.02]">
                    <Td className="align-top">
                      <div className="flex items-center gap-2 font-medium text-fg">
                        {m.name}
                        {isYou && (
                          <Badge tone="brand" className="normal-case">
                            You
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-dim">{m.email}</div>
                    </Td>
                    <Td className="align-top">
                      <RoleBadge role={m.role} />
                    </Td>
                    <Td className="align-top">{m.isActive ? <Badge tone="ok">Active</Badge> : <Badge tone="danger">Disabled</Badge>}</Td>
                    <Td className="align-top text-xs text-muted">{m.lastLoginAt ? dateTime(m.lastLoginAt) : "Never"}</Td>
                    <Td className="align-top text-xs text-dim">{shortDate(m.createdAt)}</Td>
                    <Td className="align-top">
                      {isYou ? (
                        <p className="text-xs text-dim">
                          You can&apos;t change your own role or access. Update your details on{" "}
                          <Link href="/admin/account" className="text-muted underline-offset-2 hover:text-fg hover:underline">
                            Account
                          </Link>
                          .
                        </p>
                      ) : (
                        <StaffControls member={m} />
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card title="Add staff member" description="They sign in at /admin/login with the temporary password, then change it under Account." className="xl:col-span-2">
          <ActionForm action={createStaff} resetOnSuccess showStatus={false} className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" name="name">
              <Input name="name" required maxLength={120} autoComplete="off" placeholder="Alex Rivera" />
            </Field>
            <Field label="Email" name="email">
              <Input name="email" type="email" required maxLength={191} autoComplete="off" placeholder="alex@example.com" />
            </Field>
            <Field label="Role" name="role">
              <Select name="role" defaultValue="staff">
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
                <option value="owner">Owner</option>
              </Select>
            </Field>
            <Field label="Temporary password" name="password" hint={`At least ${PASSWORD_MIN} characters. Share it privately.`}>
              <Input name="password" type="password" required minLength={PASSWORD_MIN} autoComplete="new-password" />
            </Field>
            <div className="flex flex-wrap items-center justify-end gap-3 sm:col-span-2">
              <FormStatus className="mt-0 mr-auto" />
              <SubmitButton pendingText="Adding…">Add staff member</SubmitButton>
            </div>
          </ActionForm>
        </Card>

        <Card title="Roles" className="h-fit">
          <RoleLegend />
          <p className="mt-4 border-t border-line pt-4 text-xs text-dim">
            There must always be at least one active owner. Disabling an account or resetting its password signs that person out everywhere.
          </p>
        </Card>
      </div>
    </>
  );
}
