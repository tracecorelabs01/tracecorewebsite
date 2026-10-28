import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "light";
type Size = "sm" | "md" | "lg";

const sizes: Record<Size, string> = {
  sm: "h-10 px-5 text-[11px] [--slant:10px] gap-2",
  md: "h-12 px-7 text-[12px] [--slant:13px] gap-2.5",
  lg: "h-14 px-9 text-[13px] [--slant:16px] gap-3",
};

function Inner({ children, icon }: { children: ReactNode; icon?: ReactNode | false }) {
  return (
    <>
      <span className="relative z-10">{children}</span>
      {icon !== false && (
        <span className="relative z-10 -mr-1 inline-flex size-4 overflow-hidden">
          {icon ?? (
            <>
              <ArrowUpRight className="size-4 transition-transform duration-500 ease-[var(--ease-expo)] group-hover:translate-x-4 group-hover:-translate-y-4" strokeWidth={2.2} />
              <ArrowUpRight className="absolute inset-0 size-4 -translate-x-4 translate-y-4 transition-transform duration-500 ease-[var(--ease-expo)] group-hover:translate-x-0 group-hover:translate-y-0" strokeWidth={2.2} />
            </>
          )}
        </span>
      )}
    </>
  );
}

function classes(variant: Variant, size: Size, className?: string) {
  const base =
    "group relative inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-semibold uppercase tracking-[0.16em] clip-slant transition-[filter,transform,background-color,color] duration-300 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";
  const variants: Record<Variant, string> = {
    primary:
      "bg-brand text-white hover:brightness-110 before:absolute before:inset-y-0 before:-left-1/3 before:w-1/4 before:skew-x-[-24deg] before:bg-white/40 before:blur-md before:-translate-x-full before:transition-transform before:duration-700 before:ease-[var(--ease-expo)] hover:before:translate-x-[620%]",
    ghost:
      "bg-line-strong text-fg before:absolute before:inset-px before:clip-slant before:bg-ink-900 before:transition-colors before:duration-300 hover:before:bg-ink-700 hover:bg-[#ff4d1a]/70",
    light: "bg-fg text-ink-950 hover:bg-white",
  };
  return cn(base, sizes[size], variants[variant], className);
}

type CommonProps = { variant?: Variant; size?: Size; icon?: ReactNode | false; className?: string; children: ReactNode };

export function ButtonLink({
  variant = "primary",
  size = "md",
  icon,
  className,
  children,
  ...props
}: CommonProps & Omit<ComponentProps<typeof Link>, "className" | "children">) {
  return (
    <Link className={classes(variant, size, className)} {...props}>
      <Inner icon={icon}>{children}</Inner>
    </Link>
  );
}

export function Button({
  variant = "primary",
  size = "md",
  icon,
  className,
  children,
  type = "button",
  ...props
}: CommonProps & Omit<ComponentProps<"button">, "className" | "children">) {
  return (
    <button type={type} className={classes(variant, size, className)} {...props}>
      <Inner icon={icon}>{children}</Inner>
    </button>
  );
}
