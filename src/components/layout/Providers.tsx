"use client";

import { Suspense, useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ReactLenis, useLenis, type LenisRef } from "lenis/react";
import { MotionConfig, cancelFrame, frame, useReducedMotion } from "motion/react";
import { useCart } from "@/lib/cart-store";
import { useUi } from "@/lib/ui-store";

export function Providers({ children }: { children: ReactNode }) {
  const lenisRef = useRef<LenisRef>(null);
  const reduceMotion = useReducedMotion();

  // Drive Lenis from Motion's frame loop so smooth-scroll and scroll-linked
  // animations update in the same frame (no jitter).
  useEffect(() => {
    const update = (data: { timestamp: number }) => lenisRef.current?.lenis?.raf(data.timestamp);
    frame.update(update, true);
    return () => cancelFrame(update);
  }, []);

  useEffect(() => {
    useCart.persist.rehydrate();
    useUi.getState().setHydrated();
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <ReactLenis
        root
        ref={lenisRef}
        options={{ autoRaf: false, lerp: reduceMotion ? 1 : 0.11, smoothWheel: !reduceMotion, wheelMultiplier: 1, anchors: { offset: -110 } }}
      >
        {children}
        <Suspense fallback={null}>
          <ScrollManager />
        </Suspense>
      </ReactLenis>
    </MotionConfig>
  );
}

/** Resets scroll on navigation (not on back/forward) and locks scroll behind overlays. */
function ScrollManager() {
  const pathname = usePathname();
  const lenis = useLenis();
  const fromPopState = useRef(false);
  const firstLoad = useRef(true);
  const locked = useUi((s) => s.cartOpen || s.menuOpen);

  useEffect(() => {
    const onPop = () => (fromPopState.current = true);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    const first = firstLoad.current;
    firstLoad.current = false;
    if (fromPopState.current) {
      fromPopState.current = false;
      return;
    }
    const hash = window.location.hash;
    if (hash.length > 1) {
      // Deep link like /faq#shipping: wait for the new route to paint, then jump to it.
      const id = window.setTimeout(() => {
        const el = document.getElementById(decodeURIComponent(hash.slice(1)));
        if (el) lenis?.scrollTo(el, { offset: -110, immediate: true, force: true });
      }, 60);
      return () => window.clearTimeout(id);
    }
    // A fresh load already starts at the top (or where a reload left off). Resetting it here, once this hydrates,
    // would yank back a visitor who has already started scrolling.
    if (!first) lenis?.scrollTo(0, { immediate: true, force: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on route change
  }, [pathname]);

  useEffect(() => {
    if (!lenis) return;
    if (locked) lenis.stop();
    else lenis.start();
  }, [locked, lenis]);

  useEffect(() => {
    document.documentElement.style.overflow = locked ? "hidden" : "";
  }, [locked]);

  return null;
}
