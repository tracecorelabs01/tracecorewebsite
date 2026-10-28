import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, Copy, ExternalLink, Trash2 } from "lucide-react";
import { deleteProduct, duplicateProduct, saveProduct } from "@/actions/admin/products";
import { ConfirmButton } from "@/components/admin/forms";
import { ImageManager } from "@/components/admin/ImageManager";
import { ProductForm } from "@/components/admin/ProductForm";
import { PageHeader } from "@/components/admin/ui";
import { param } from "@/lib/admin/format";
import { getProductForEdit, listCategories } from "@/lib/admin/products";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Edit product" };
// Admin pages read the session and live data on every request.
export const instant = false;

export default async function EditProductPage({ params, searchParams }: PageProps<"/admin/products/[id]">) {
  await requireAdmin("admin");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const productId = Number(id);
  if (!Number.isInteger(productId)) notFound();
  const [data, categories] = await Promise.all([getProductForEdit(productId), listCategories()]);
  if (!data) notFound();
  const { product, images } = data;

  return (
    <>
      <PageHeader
        title={product.name}
        description={<span className="font-mono text-xs">/product/{product.slug}</span>}
        back={{ href: "/admin/products", label: "Products" }}
        actions={
          <>
            {product.status === "active" && (
              <a href={`/product/${product.slug}`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs text-muted hover:bg-white/5 hover:text-fg">
                View in store <ExternalLink className="size-3.5" />
              </a>
            )}
            <ConfirmButton action={duplicateProduct.bind(null, product.id)}>
              <Copy className="size-3.5" /> Duplicate
            </ConfirmButton>
            <ConfirmButton action={deleteProduct.bind(null, product.id)} confirm={`Delete “${product.name}” permanently? Past orders keep their line items.`} variant="danger">
              <Trash2 className="size-3.5" /> Delete
            </ConfirmButton>
          </>
        }
      />
      {param(sp.created) && (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-ok/30 bg-ok/10 px-4 py-3 text-sm">
          <CheckCircle2 className="size-4 text-ok" /> Product created. Add photos below, then set the status to Active to publish it.
        </p>
      )}
      <div className="space-y-4">
        <ImageManager productId={product.id} images={images} />
        <ProductForm action={saveProduct.bind(null, product.id)} product={product} categories={categories} />
      </div>
    </>
  );
}
