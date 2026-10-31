import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { BadgePercent, Handshake, Wallet } from "lucide-react";
import { AccountShell, Panel, PARTNER_TABS, Pill, shortDay } from "@/components/account/AccountShell";
import { ApplyForm, CopyText } from "@/components/partners/PartnerForms";
import { DiscordIcon } from "@/components/ui/icons";
import { PageHero } from "@/components/ui/PageHero";
import { isDbConfigured } from "@/db";
import { getLinkedAccounts } from "@/lib/account";
import { param } from "@/lib/admin/format";
import { COMMISSION_STATUS } from "@/lib/affiliate-labels";
import { getProgram, partnerBalance, partnerCommissions, partnerForCustomer, partnerStats } from "@/lib/affiliates";
import { getCurrentCustomer } from "@/lib/auth/customer";
import { oauthEnabled } from "@/lib/auth/oauth";
import { site } from "@/lib/site";
import { cn, formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Partner program",
  description: "Earn commission promoting TraceCore Lab hardware, with partner prices for your audience and payouts by PayPal or store credit.",
};
// Reads the session on every request.
export const instant = false;

const usd = (cents: number) => formatPrice(cents / 100);

// How signing in with or connecting Discord went (/api/auth/discord/callback sends people back here).
const NOTICES: Record<string, { ok: boolean; text: string }> = {
  discord: { ok: true, text: "Discord connected. You can apply now." },
  taken: { ok: false, text: "That Discord account is linked to another TraceCore Lab account. Sign out, then continue with Discord to use that one." },
  oauth: { ok: false, text: "Signing in with Discord didn't work. Please try again." },
  cancelled: { ok: false, text: "Discord sign-in was cancelled." },
  unverified: { ok: false, text: "Your Discord account's email isn't verified yet. Verify it in Discord, then try again." },
};

export default async function PartnersPage({ searchParams }: PageProps<"/partners">) {
  // Linked from the header and homepage: without this, prefetching it would run the database queries below.
  await connection();
  const me = await getCurrentCustomer();
  const partner = me && isDbConfigured() ? await partnerForCustomer(me.id) : null;
  const program = isDbConfigured() ? await getProgram() : null;
  if (partner?.status === "approved") return <Dashboard partnerId={partner.id} code={partner.code} name={partner.name} cookieDays={program!.cookieDays} />;
  // Partners sign up with Discord only: it's their login, and how the team reaches them.
  const [discord, sp] = await Promise.all([me ? getLinkedAccounts(me.id).then((l) => l.discord) : null, searchParams]);
  const notice = NOTICES[param(sp.linked) ?? param(sp.error) ?? ""];

  return (
    <>
      <PageHero
        kicker="Partner program"
        crumbs={[{ label: "Home", href: "/" }, { label: "Partners" }]}
        lines={[
          <span key="a">
            Partner <span className="text-gradient">with us.</span>
          </span>,
        ]}
        description="Share TraceCore Lab with your audience. They get partner prices; you earn on every order they place."
      />
      <section className="container-x grid gap-4 pb-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="grid content-start gap-4">
          {[
            { Icon: BadgePercent, title: "Commission on every order", text: "A percentage or a fixed amount per product, set for your partnership." },
            { Icon: Handshake, title: "Partner prices for your audience", text: "Customers who use your link or code get the prices we set for you." },
            { Icon: Wallet, title: "Paid your way", text: "Take your earnings as store credit straight away, or by PayPal." },
          ].map(({ Icon, title, text }) => (
            <div key={title} className="flex gap-4 rounded-3xl border border-line bg-ink-900/60 p-6">
              <Icon className="mt-0.5 size-5 shrink-0 text-blaze" />
              <div>
                <p className="font-medium">{title}</p>
                <p className="mt-1 text-sm text-muted">{text}</p>
              </div>
            </div>
          ))}
        </div>
        <Panel title={partner ? "Your application" : "Apply"}>
          {notice && (
            <p role={notice.ok ? "status" : "alert"} className={cn("mb-5 text-sm", notice.ok ? "text-ok" : "text-[#ff6b5e]")}>
              {notice.text}
            </p>
          )}
          {!program?.enabled && !partner ? (
            <p className="text-muted">The partner program isn&apos;t taking applications right now. Check back soon.</p>
          ) : !partner && !oauthEnabled("discord") ? (
            <p className="text-muted">Partner sign-up opens soon. Check back shortly.</p>
          ) : !me ? (
            <div className="grid gap-4">
              <p className="text-muted">Partners sign up with Discord, with no email or password. Your Discord account is your partner login.</p>
              <DiscordButton href="/api/auth/discord/start?next=/partners">Continue with Discord</DiscordButton>
            </div>
          ) : !partner && !discord ? (
            <div className="grid gap-4">
              <p className="text-muted">Partners sign up through Discord. Connect your Discord account to {me.email} to apply.</p>
              <DiscordButton href="/api/auth/discord/start?link=1&next=/partners">Connect Discord</DiscordButton>
            </div>
          ) : !partner ? (
            <div className="grid gap-5">
              <p className="flex items-center gap-2 text-sm text-muted">
                <DiscordIcon className="size-4 text-[#5865F2]" />
                Applying as <span className="text-fg">{discord}</span>
              </p>
              <ApplyForm defaultName={[me.firstName, me.lastName].filter(Boolean).join(" ")} />
            </div>
          ) : partner.status === "pending" ? (
            <p className="text-muted">
              We&apos;ve got your application for <span className="text-fg">{partner.name}</span>, sent {shortDay(partner.createdAt)}. The team reviews every one by hand and will email you the decision.
            </p>
          ) : partner.status === "suspended" ? (
            <p className="text-muted">Your partner account is paused. Contact us if you have questions.</p>
          ) : (
            <p className="text-muted">We couldn&apos;t approve your application this time. Contact us if your channel or shop has grown and you&apos;d like us to take another look.</p>
          )}
        </Panel>
      </section>
    </>
  );
}

function DiscordButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="flex h-12 items-center justify-center gap-2.5 rounded-xl bg-[#5865F2] px-6 text-sm font-semibold text-white transition-[filter] hover:brightness-110">
      <DiscordIcon className="size-5" />
      {children}
    </a>
  );
}

async function Dashboard({ partnerId, code, name, cookieDays }: { partnerId: number; code: string; name: string; cookieDays: number }) {
  const [stats, balance, recent] = await Promise.all([partnerStats(partnerId), partnerBalance(partnerId), partnerCommissions(partnerId, 6)]);
  const link = `${site.url}/?ref=${code}`;
  return (
    <AccountShell tabs={PARTNER_TABS} kicker="Partner portal" active="/partners" title={<span>Hi, <span className="text-gradient">{name}.</span></span>} description="Your link, your code and how they're doing over the last 30 days.">
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Clicks", value: stats.clicks.toLocaleString("en-US") },
            { label: "Paid orders", value: stats.orders.toLocaleString("en-US") },
            { label: "Conversion", value: `${(stats.conversion * 100).toFixed(1)}%` },
            { label: "Earned", value: usd(stats.earnedCents) },
          ].map((s) => (
            <div key={s.label} className="rounded-3xl border border-line bg-ink-900/60 p-6">
              <p className="type-kicker text-dim">{s.label}</p>
              <p className="mt-3 font-display text-4xl">{s.value}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Panel title="Share">
            <div className="grid gap-5">
              <div>
                <p className="type-kicker text-dim">Your link</p>
                <div className="mt-2">
                  <CopyText text={link} />
                </div>
                <p className="mt-1.5 text-xs text-dim">Add ?ref={code} to any product page link too. Visitors keep your prices for {cookieDays} days.</p>
              </div>
              <div>
                <p className="type-kicker text-dim">Your code</p>
                <div className="mt-2">
                  <CopyText text={code} />
                </div>
                <p className="mt-1.5 text-xs text-dim">Customers can type it at checkout instead of using your link.</p>
              </div>
            </div>
          </Panel>
          <Panel title="Earnings">
            <dl className="grid grid-cols-2 gap-4">
              {[
                ["Pending", balance.pendingCents, "Waiting for delivery and the hold period"],
                ["Available", balance.availableCents, "Ready to pay out"],
                ["In payout", balance.requestedCents, "PayPal payout on its way"],
                ["Paid", balance.paidCents, "All time"],
              ].map(([label, cents, hint]) => (
                <div key={label as string}>
                  <dt className="type-kicker text-dim">{label}</dt>
                  <dd className="mt-1 font-display text-3xl">{usd(cents as number)}</dd>
                  <dd className="text-xs text-dim">{hint}</dd>
                </div>
              ))}
            </dl>
            <Link href="/partners/payouts" className="mt-5 inline-block text-sm text-fg underline underline-offset-4 hover:text-blaze">
              Payouts
            </Link>
          </Panel>
        </div>
        <Panel title="Latest commissions" action={<Link href="/partners/orders" className="text-sm text-muted hover:text-fg">All orders</Link>}>
          {recent.length === 0 ? (
            <p className="text-muted">Nothing yet. Commissions show up here as soon as someone you referred pays for an order.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-mono text-sm">{c.orderNumber ?? c.note}</p>
                    <p className="text-xs text-dim">{shortDay(c.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Pill tone={COMMISSION_STATUS[c.status].tone}>{COMMISSION_STATUS[c.status].label}</Pill>
                    <span className="font-mono">{usd(c.amountCents)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AccountShell>
  );
}
