// Building blocks shared by the shipment form and its packages editor.
import type { ChangeEvent, ComponentProps, ReactNode } from "react";
import { ChevronDown, CircleAlert } from "lucide-react";

import { controlClass } from "@/components/ui/field";
import { cn } from "@/lib/utils/cn";
import { tidy } from "@/lib/validation/text";
import type { FieldErrors } from "@/services/customs/shipment-input";

/** Stable ids from dotted paths, so the parent can focus the first invalid field. */
export const fieldId = (path: string) => `shipment-${path.replace(/\./g, "-")}`;

export const input = cn(controlClass, "h-10");
export const numeric = cn(input, "tabular-nums");

export const iconButton = cn(
  "inline-grid size-8 place-items-center rounded-md text-ink-muted outline-none transition-colors duration-150",
  "enabled:hover:bg-ground enabled:hover:text-ink focus-visible:ring-2 focus-visible:ring-accent",
  "disabled:cursor-not-allowed disabled:opacity-40",
);

export function firstError(errors: FieldErrors, path: string) {
  return errors[path]?.[0];
}

/** aria wiring shared by every control: invalid state and the message that explains it. */
export function a11y(path: string, error: string | undefined, hasHint = false) {
  return {
    id: fieldId(path),
    name: path,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${fieldId(path)}-error` : hasHint ? `${fieldId(path)}-hint` : undefined,
  } as const;
}

/**
 * Applies a typing mask (uppercase, no stray spaces) and writes the result
 * straight back with the caret where the user left it; otherwise React's
 * re-render would throw the caret to the end.
 */
export function masked(
  event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  mask: ((value: string) => string) | undefined = tidy,
): string {
  const element = event.currentTarget;
  const raw = element.value;
  if (element instanceof HTMLSelectElement) return raw;
  const next = mask(raw);
  if (next !== raw) {
    const caret = mask(raw.slice(0, element.selectionStart ?? raw.length)).length;
    element.value = next;
    element.setSelectionRange(caret, caret);
  }
  return next;
}

export function FormField({
  path,
  label,
  optional,
  hint,
  error,
  className,
  children,
}: {
  path: string;
  label: string;
  optional?: boolean;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      <label htmlFor={fieldId(path)} className="text-sm font-medium">
        {label}
        {optional && <span className="font-normal text-ink-muted"> (optional)</span>}
      </label>
      {children}
      {error ? (
        <p id={`${fieldId(path)}-error`} className="flex gap-1.5 text-[13px] leading-5 font-medium text-danger">
          <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${fieldId(path)}-hint`} className="text-[13px] text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select {...props} className={cn(controlClass, "h-10 cursor-pointer appearance-none pr-10", className)}>
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-muted"
      />
    </div>
  );
}

export function Fieldset({
  legend,
  description,
  aside,
  children,
}: {
  legend: string;
  description: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <fieldset className="grid gap-4 border-t border-hairline pt-6 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <legend className="text-sm font-semibold tracking-tight">{legend}</legend>
          <p className="mt-0.5 text-[13px] text-ink-muted">{description}</p>
        </div>
        {aside}
      </div>
      {children}
    </fieldset>
  );
}
