import type { Metadata } from "next";
import { saveProduct } from "@/actions/admin/products";
import { ProductForm } from "@/components/admin/ProductForm";
import { PageHeader } from "@/components/admin/ui";
import { listCategories } from "@/lib/admin/products";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "New product" };
// Admin pages read the session and live data on every request.
export const instant = false;

export default async function NewProductPage() {
  await requireAdmin("admin");
  const categories = await listCategories();
  return (
    <>
      <PageHeader title="New product" description="Photos can be added after the first save." back={{ href: "/admin/products", label: "Products" }} />
      <ProductForm action={saveProduct.bind(null, null)} categories={categories} />
    </>
  );
}
