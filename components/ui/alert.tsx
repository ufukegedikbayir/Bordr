import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

export function Alert({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <div
      id={id}
      role="alert"
      className="flex gap-2.5 rounded-lg border border-danger-border bg-danger-surface px-3 py-2.5 text-sm leading-5 text-danger"
    >
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
