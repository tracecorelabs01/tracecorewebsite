import { ClipboardCheck, Wallet } from "lucide-react";
import { Kicker } from "@/components/ui/bits";
import { ButtonLink } from "@/components/ui/Button";
import { DiscordIcon } from "@/components/ui/icons";
import { Reveal, RevealLines } from "@/components/ui/motion";

const STEPS = [
  { Icon: DiscordIcon, discord: true, title: "Sign in with Discord", text: "No email or password. Your Discord account is your partner login." },
  { Icon: ClipboardCheck, discord: false, title: "Apply", text: "Tell us about your channel, shop or community. The team reviews every application by hand." },
  { Icon: Wallet, discord: false, title: "Share and get paid", text: "Your audience gets partner prices through your link or code. You earn on every order, paid by PayPal or store credit." },
];

export function PartnerCta() {
  return (
    <section className="relative py-28 md:py-36" aria-labelledby="partners-heading">
      <div className="container-x grid gap-14 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-5">
          <Kicker index="06">Partner program</Kicker>
          <RevealLines as="h2" className="type-h2 mt-5" lines={[<span key="a" id="partners-heading">Share it.</span>, <span key="b" className="text-gradient">Get paid.</span>]} />
          <Reveal delay={0.1}>
            <p className="mt-6 max-w-md text-muted">Creators, streamers and community owners: give your audience partner prices on TraceCoreLab hardware and earn commission on every order they place.</p>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
              <ButtonLink href="/partners">Become a partner</ButtonLink>
              <span className="flex items-center gap-2 text-sm text-dim">
                <DiscordIcon className="size-4" />
                Sign-up through Discord only
              </span>
            </div>
          </Reveal>
        </div>
        <ol className="grid gap-4 lg:col-span-7">
          {STEPS.map(({ Icon, discord, title, text }, i) => (
            <Reveal as="li" key={title} delay={0.1 + i * 0.08} className="flex items-start gap-5 rounded-3xl border border-line bg-ink-900/60 p-6">
              <span
                className={
                  discord
                    ? "grid size-12 shrink-0 place-items-center rounded-2xl bg-[#5865F2] text-white shadow-[0_10px_30px_-8px_rgb(88_101_242/0.7)]"
                    : "grid size-12 shrink-0 place-items-center rounded-2xl border border-line bg-ink-950 text-blaze"
                }
              >
                <Icon className="size-6" />
              </span>
              <span>
                <span className="font-mono text-xs text-dim">0{i + 1}</span>
                <span className="mt-1 block font-display text-2xl uppercase">{title}</span>
                <span className="mt-1 block text-sm text-muted">{text}</span>
              </span>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
