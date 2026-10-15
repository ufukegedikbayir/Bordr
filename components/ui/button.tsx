import type { ComponentProps } from "react";

import { cn } from "@/lib/utils/cn";

import { Spinner } from "./spinner";

const variants = {
  primary:
    "bg-accent text-accent-ink shadow-[0_1px_1px_oklch(0.21_0.02_255/0.12)] not-disabled:hover:bg-accent-hover",
  secondary:
    "border border-hairline-strong bg-surface text-ink not-disabled:hover:bg-ground",
} as const;

type Variant = keyof typeof variants;

/** Button styling, also for links that should look like buttons. */
export function buttonClass(variant: Variant = "primary", className?: string) {
  return cn(
    "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium",
    "transition-[background-color,opacity] duration-150 ease-out",
    "outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
    "disabled:cursor-not-allowed disabled:opacity-60 aria-busy:cursor-wait aria-busy:opacity-90",
    variants[variant],
    className,
  );
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: Variant;
  loading?: boolean;
};

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      // While loading, stay focusable (aria-disabled, not disabled) so focus
      // isn't dropped to <body> mid-submit; forms guard against re-submits.
      disabled={disabled}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      className={buttonClass(variant, className)}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}
