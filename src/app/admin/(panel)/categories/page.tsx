import type { Metadata } from "next";
import { FolderTree, Trash2 } from "lucide-react";
import { deleteCategory, saveCategory } from "@/actions/admin/products";
import { ActionForm, ConfirmButton, Field, Input, SubmitButton } from "@/components/admin/forms";
import { Card, EmptyState, PageHeader } from "@/components/admin/ui";
import { listCategories } from "@/lib/admin/products";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Categories" };
// Admin pages read the session and live data on every request.
export const instant = false;

export default async function CategoriesPage() {
  await requireAdmin("admin");
  const categories = await listCategories();

  return (
    <>
      <PageHeader title="Categories" description="Group products into the tabs shown on the shop page. Lower sort order shows first." />
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
          {categories.length === 0 ? (
            <Card>
              <EmptyState icon={<FolderTree className="size-5" />} title="No categories yet" description="Add your first category on the right." />
            </Card>
          ) : (
            categories.map((c) => (
              <Card key={c.id}>
                <ActionForm action={saveCategory.bind(null, c.id)} className="grid gap-3 md:grid-cols-12 md:items-end">
                  <Field label="Name" name="name" className="md:col-span-3">
                    <Input name="name" defaultValue={c.name} required />
                  </Field>
                  <Field label="Slug" name="slug" className="md:col-span-3">
                    <Input name="slug" defaultValue={c.slug} className="font-mono" />
                  </Field>
                  <Field label="Short description" name="blurb" className="md:col-span-4">
                    <Input name="blurb" defaultValue={c.blurb} maxLength={255} />
                  </Field>
                  <Field label="Order" name="sortOrder" className="md:col-span-2">
                    <Input name="sortOrder" type="number" defaultValue={c.sortOrder} />
                  </Field>
                  <div className="flex items-center justify-between gap-3 md:col-span-12">
                    <span className="text-xs text-dim">
                      {c.products} product{c.products === 1 ? "" : "s"}
                    </span>
                    <div className="flex gap-2">
                      <ConfirmButton action={deleteCategory.bind(null, c.id)} confirm={`Delete “${c.name}”? Its products become uncategorised.`} variant="danger">
                        <Trash2 className="size-3.5" /> Delete
                      </ConfirmButton>
                      <SubmitButton variant="secondary" size="sm">
                        Save
                      </SubmitButton>
                    </div>
                  </div>
                </ActionForm>
              </Card>
            ))
          )}
        </div>
        <Card title="Add category" className="h-fit">
          <ActionForm action={saveCategory.bind(null, null)} resetOnSuccess className="space-y-4">
            <Field label="Name" name="name">
              <Input name="name" required placeholder="Accessories" />
            </Field>
            <Field label="Slug" name="slug" hint="Leave blank to generate.">
              <Input name="slug" className="font-mono" />
            </Field>
            <Field label="Short description" name="blurb">
              <Input name="blurb" maxLength={255} />
            </Field>
            <Field label="Sort order" name="sortOrder">
              <Input name="sortOrder" type="number" defaultValue={categories.length} />
            </Field>
            <SubmitButton className="w-full">Add category</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
