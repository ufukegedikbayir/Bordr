"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type ComponentProps, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

const inputClass = cn(
  "h-10 w-full rounded-lg border border-hairline-strong bg-surface px-3 text-base text-ink sm:text-sm",
  "shadow-[inset_0_1px_1px_oklch(0.21_0.02_255/0.03)] placeholder:text-ink-muted",
  "transition-[border-color,box-shadow] duration-150 ease-out outline-none",
  // Focus is a solid 2px green edge (1px border + 1px ring), matching buttons.
  "hover:border-ink-muted/50 focus:border-accent focus:ring-1 focus:ring-accent",
  "aria-invalid:border-danger aria-invalid:focus:border-danger aria-invalid:focus:ring-danger",
  "read-only:cursor-wait disabled:cursor-not-allowed disabled:opacity-60",
);

type FieldProps = Omit<ComponentProps<"input">, "id" | "aria-describedby"> & {
  label: string;
  hint?: ReactNode;
  /** id of an error message describing this field; also marks it invalid. */
  errorId?: string;
};

function describedBy(...ids: Array<string | undefined>) {
  return ids.filter(Boolean).join(" ") || undefined;
}

export function Field({ label, hint, errorId, className, ...props }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        aria-describedby={describedBy(errorId, hintId)}
        aria-invalid={errorId ? true : undefined}
        className={cn(inputClass, className)}
        {...props}
      />
      {hint && (
        <p id={hintId} className="text-[13px] text-ink-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

export function PasswordField({ label, hint, errorId, className, ...props }: Omit<FieldProps, "type">) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const [visible, setVisible] = useState(false);

  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          aria-describedby={describedBy(errorId, hintId)}
          aria-invalid={errorId ? true : undefined}
          className={cn(inputClass, "pr-11", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          aria-controls={id}
          className={cn(
            "absolute inset-y-1 right-1 grid w-9 place-items-center rounded-md text-ink-muted",
            "transition-colors duration-150 hover:bg-ground hover:text-ink",
            "outline-none focus-visible:ring-2 focus-visible:ring-accent",
          )}
        >
          {visible ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
        </button>
      </div>
      {hint && (
        <p id={hintId} className="text-[13px] text-ink-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
