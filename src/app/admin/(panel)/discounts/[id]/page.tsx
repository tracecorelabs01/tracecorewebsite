import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteDiscount, saveDiscount } from "@/actions/admin/discounts";
import { DiscountStateBadge } from "@/components/admin/community/badges";
import { DiscountForm } from "@/components/admin/DiscountForm";
import { ConfirmButton } from "@/components/admin/forms";
import { Card, PageHeader } from "@/components/admin/ui";
import { discountLabel, discountState, getDiscount } from "@/lib/admin/discounts";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Edit discount" };
// Admin pages read the session and live data on every request.
export const instant = false;

export default async function EditDiscountPage({ params }: PageProps<"/admin/discounts/[id]">) {
  await requireAdmin("admin");
  const { id } = await params;
  const discountId = Number(id);
  if (!Number.isInteger(discountId) || discountId < 1) notFound();
  const discount = await getDiscount(discountId);
  if (!discount) notFound();

  return (
    <>
      <PageHeader
        title={discount.code}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <DiscountStateBadge state={discountState(discount)} />
            {discountLabel(discount)} · used {discount.usedCount} {discount.usedCount === 1 ? "time" : "times"}
          </span>
        }
        back={{ href: "/admin/discounts", label: "Discounts" }}
        actions={
          <ConfirmButton
            action={deleteDiscount.bind(null, discount.id)}
            confirm={`Delete ${discount.code} permanently? Customers won't be able to use it. Past orders keep their discount.`}
            variant="danger"
          >
            <Trash2 className="size-3.5" /> Delete
          </ConfirmButton>
        }
      />
      <Card title="Code details" description="Changes apply to the next checkout. Orders already placed keep the discount they received.">
        <DiscountForm action={saveDiscount.bind(null, discount.id)} discount={discount} />
      </Card>
    </>
  );
}
