"use client";

import { createContext, use, useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useActionForm } from "./forms";
import { tabBarClass, tabClass, tabCountClass } from "./ui";

const ActiveTab = createContext<{ active: string; select: (id: string) => void }>({ active: "", select: () => {} });

const onHashChange = (cb: () => void) => {
  addEventListener("hashchange", cb);
  return () => removeEventListener("hashchange", cb);
};

/**
 * Tabs for a page whose sections load together. Every panel stays mounted, so a form still sends the fields on hidden
 * tabs and nothing typed is lost when switching. The open tab is the URL hash: /admin/products/2#costs opens on Costs,
 * and a reload or save stays on it.
 */
export function Tabs({ tabs, children }: { tabs: { id: string; label: string; count?: ReactNode }[]; children: ReactNode }) {
  const hash = useSyncExternalStore(onHashChange, () => location.hash.slice(1), () => "");
  const active = tabs.some((t) => t.id === hash) ? hash : tabs[0].id;
  const select = (id: string) => {
    // Replaced, not pushed, so switching tabs doesn't fill the back button. That fires no hashchange, so send one.
    history.replaceState(null, "", id === tabs[0].id ? location.pathname + location.search : `#${id}`);
    dispatchEvent(new HashChangeEvent("hashchange"));
  };
  return (
    <ActiveTab value={{ active, select }}>
      <div role="tablist" className={cn(tabBarClass, "mb-4")}>
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" id={`tab-${t.id}`} aria-selected={t.id === active} aria-controls={`panel-${t.id}`} onClick={() => select(t.id)} className={tabClass(t.id === active)}>
            {t.label}
            {t.count != null && <span className={tabCountClass(t.id === active)}>{t.count}</span>}
          </button>
        ))}
      </div>
      {children}
    </ActiveTab>
  );
}

/** The open tab, for content that shows on several tabs. */
export function useActiveTab() {
  return use(ActiveTab).active;
}

// Rejected saves already sent to a tab: the first panel holding one of the errors opens, the others leave it.
const shown = new WeakSet<object>();

export function TabPanel({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  const { active, select } = use(ActiveTab);
  const { state } = useActionForm();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!state?.fieldErrors || shown.has(state) || !ref.current?.querySelector('[aria-invalid="true"],[data-field-error]')) return;
    shown.add(state);
    select(id);
  }, [state, id, select]);
  return (
    <div ref={ref} role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} hidden={active !== id} className={className}>
      {children}
    </div>
  );
}
