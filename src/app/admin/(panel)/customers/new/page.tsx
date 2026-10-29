import type { Metadata } from "next";
import { createCustomer } from "@/actions/admin/customers";
import { ActionForm, Field, FormStatus, Input, SubmitButton } from "@/components/admin/forms";
import { Card, PageHeader } from "@/components/admin/ui";
import { PASSWORD_MIN } from "@/lib/auth/password";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Add customer" };
// Admin pages read the session and live data on every request.
export const instant = false;

export default async function NewCustomerPage() {
  await requireAdmin("admin");
  return (
    <>
      <PageHeader title="Add customer" description="Creates the customer with an account they can log in to right away." back={{ href: "/admin/customers", label: "Customers" }} />
      <Card title="Customer details" description="They log in at /account/login with this email and the temporary password, then change it under their account." className="max-w-3xl">
        <ActionForm action={createCustomer} showStatus={false} className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" name="email" className="sm:col-span-2">
            <Input name="email" type="email" required maxLength={191} autoComplete="off" placeholder="sam@example.com" />
          </Field>
          <Field label="First name" name="firstName">
            <Input name="firstName" maxLength={80} autoComplete="off" />
          </Field>
          <Field label="Last name" name="lastName">
            <Input name="lastName" maxLength={80} autoComplete="off" />
          </Field>
          <Field label="Phone" name="phone">
            <Input name="phone" type="tel" maxLength={40} autoComplete="off" />
          </Field>
          <Field label="Country" name="country">
            <Input name="country" maxLength={80} autoComplete="off" />
          </Field>
          <Field label="Temporary password" name="password" hint={`At least ${PASSWORD_MIN} characters. Share it privately.`} className="sm:col-span-2">
            <Input name="password" type="password" required minLength={PASSWORD_MIN} autoComplete="new-password" />
          </Field>
          <div className="flex flex-wrap items-center justify-end gap-3 sm:col-span-2">
            <FormStatus className="mt-0 mr-auto" />
            <SubmitButton pendingText="Creating…">Create customer</SubmitButton>
          </div>
        </ActionForm>
      </Card>
    </>
  );
}
