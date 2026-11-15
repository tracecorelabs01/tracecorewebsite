import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { deleteGroup, saveGroup, saveRules } from "@/actions/admin/affiliates";
import { RulesTable } from "@/components/admin/affiliates/RulesTable";
import { TermsFields } from "@/components/admin/affiliates/TermsFields";
import { ActionForm, ConfirmButton, Field, Input, SubmitButton, Toggle } from "@/components/admin/forms";
import { Card, PageHeader } from "@/components/admin/ui";
import { generalTermsFor, rulesFor } from "@/lib/affiliates";
import { getGroup } from "@/lib/admin/affiliates";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Partner group" };
// Admin pages read the session and live data on every request.
export const instant = false;

export default async function GroupPage({ params }: PageProps<"/admin/affiliates/groups/[id]">) {
  await requireAdmin("admin");
  const id = Number((await params).id);
  const group = Number.isInteger(id) ? await getGroup(id) : null;
  if (!group) notFound();
  const [rules, terms] = await Promise.all([rulesFor({ level: "group", id }), generalTermsFor({ level: "group", id })]);

  return (
    <>
      <PageHeader
        title={group.name}
        description={
          <>
            {group.description || "A partner group: its commission and discount limit apply to every partner in it."}{" "}
            <Link href={`/admin/affiliates?group=${id}`} className="text-fg underline underline-offset-4 hover:text-amber">
              See its partners
            </Link>
          </>
        }
        back={{ href: "/admin/affiliates?tab=groups", label: "Groups" }}
        actions={
          <ConfirmButton action={deleteGroup.bind(null, id)} variant="danger" size="md" confirm={`Delete ${group.name}? Its partners move to the default group.`}>
            Delete group
          </ConfirmButton>
        }
      />
      <div className="grid grid-cols-1 gap-4">
        <Card title="Group" description="The commission and discount limit apply to every partner in the group, on every product without a row of its own (here or in the program's products).">
          <ActionForm action={saveGroup.bind(null, id)} className="grid gap-4 md:grid-cols-3">
            <Field label="Name" name="name">
              <Input name="name" defaultValue={group.name} maxLength={80} />
            </Field>
            <Field label="Description" name="description" className="md:col-span-2">
              <Input name="description" defaultValue={group.description} maxLength={255} />
            </Field>
            <TermsFields own={terms.own} inherited={terms.inherited} above="the program" />
            <div className="md:col-span-2">
              <Toggle name="isDefault" label="Default group" description="New partners join it, and partners without a group use it." defaultChecked={group.isDefault} />
            </div>
            <div className="flex items-end">
              <SubmitButton>Save group</SubmitButton>
            </div>
          </ActionForm>
        </Card>
        <Card title="Product exceptions" description="Only for products that should differ from the group's terms above. Most groups need none." padded={false}>
          <RulesTable level="group" rows={rules} action={saveRules.bind(null, { level: "group", id })} />
        </Card>
      </div>
    </>
  );
}
