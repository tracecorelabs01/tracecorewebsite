import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteOffer, saveOffer } from "@/actions/admin/loyalty";
import { ConfirmButton } from "@/components/admin/forms";
import { LoyaltyOfferForm } from "@/components/admin/LoyaltyOfferForm";
import { Card, PageHeader } from "@/components/admin/ui";
import { getOffer } from "@/lib/admin/loyalty";
import { requireAdmin } from "@/lib/auth/session";
import { rewardLabel } from "@/lib/loyalty";

export const metadata: Metadata = { title: "Edit offer" };
// Admin pages read the session and live data on every request.
export const instant = false;

export default async function EditOfferPage({ params }: PageProps<"/admin/loyalty/offers/[id]">) {
  await requireAdmin("admin");
  const { id } = await params;
  const offerId = Number(id);
  if (!Number.isInteger(offerId) || offerId < 1) notFound();
  const offer = await getOffer(offerId);
  if (!offer) notFound();

  return (
    <>
      <PageHeader
        title={offer.title}
        description={`${rewardLabel(offer)} for ${offer.pointsCost.toLocaleString("en-US")} points`}
        back={{ href: "/admin/loyalty", label: "Loyalty" }}
        actions={
          <ConfirmButton action={deleteOffer.bind(null, offer.id)} confirm={`Delete "${offer.title}"? Customers can't redeem it any more. Codes already issued keep working.`} variant="danger">
            <Trash2 className="size-3.5" /> Delete
          </ConfirmButton>
        }
      />
      <Card title="Offer details" description="Changes apply to future redemptions. Codes already issued keep the reward they were redeemed for.">
        <LoyaltyOfferForm action={saveOffer.bind(null, offer.id)} offer={offer} />
      </Card>
    </>
  );
}
