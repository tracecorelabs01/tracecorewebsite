import type { Metadata } from "next";
import { AddressBook, ProfileForm } from "@/components/account/AccountForms";
import { AccountShell, Panel } from "@/components/account/AccountShell";
import { getProfile } from "@/lib/account";
import { listAddresses } from "@/lib/address";
import { requireCustomer } from "@/lib/auth/customer";

export const metadata: Metadata = { title: "Your details", robots: { index: false } };
// Reads the session on every request.
export const instant = false;

export default async function DetailsPage() {
  const me = await requireCustomer();
  const [profile, addresses] = await Promise.all([getProfile(me.id), listAddresses(me.id)]);

  return (
    <AccountShell
      active="/account/details"
      title={
        <span>
          Your <span className="text-gradient">details.</span>
        </span>
      }
      description="Your name, phone and the addresses checkout offers you."
    >
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Panel title="Profile">
          <ProfileForm email={me.email} firstName={profile?.firstName ?? ""} lastName={profile?.lastName ?? ""} phone={profile?.phone ?? ""} />
        </Panel>
        <Panel title="Addresses">
          <AddressBook addresses={addresses} />
        </Panel>
      </div>
    </AccountShell>
  );
}
