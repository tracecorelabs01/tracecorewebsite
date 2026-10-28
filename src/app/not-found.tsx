import { LogoMark } from "@/components/brand/Logo";
import { StoreShell } from "@/components/layout/StoreShell";
import { ButtonLink } from "@/components/ui/Button";
import { getStoreSettings } from "@/lib/catalog/server";

export default async function NotFound() {
  const settings = await getStoreSettings();
  return (
    <StoreShell settings={settings}>
    <section className="relative isolate flex min-h-[100svh] items-center overflow-hidden pt-28">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute inset-0 bg-grid opacity-60 mask-radial" />
        <div className="absolute left-1/2 top-1/2 size-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(255_61_0/0.2),transparent_65%)]" />
      </div>
      <div className="container-x flex flex-col items-center text-center">
        <LogoMark className="h-14 animate-float" />
        <h1 className="relative mt-8 font-display text-[34vw] leading-[0.8] md:text-[22vw]">
          <span className="text-gradient">404</span>
          <span aria-hidden className="glitch-a absolute inset-0 text-[#ff3d00] mix-blend-screen">
            404
          </span>
          <span aria-hidden className="glitch-b absolute inset-0 text-silver mix-blend-screen">
            404
          </span>
        </h1>
        <p className="mt-6 type-kicker text-blaze">Signal lost</p>
        <p className="mt-3 max-w-md text-muted">We couldn&apos;t trace that page. It may have moved, or the link might be broken.</p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/">Back home</ButtonLink>
          <ButtonLink href="/shop" variant="ghost">
            Visit the store
          </ButtonLink>
        </div>
      </div>
    </section>
    </StoreShell>
  );
}
