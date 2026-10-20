import type { CSSProperties, ReactNode } from "react";
import { CircleAlert, FileText } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { countryName, type CountryCode, type CustomsResult } from "@/services/customs/constants";

import { InvoiceDownload } from "./InvoiceDownload";

export type Outcome =
  | { status: "idle" }
  | { status: "pending"; country: CountryCode }
  | { status: "success"; data: CustomsResult; description: string; saved: boolean; logo: string | null }
  | { status: "error"; message: string };

const LABELS = {
  hs: "Suggested HS code",
  duty: "Estimated import duty",
  docs: "Required documents",
} as const;

const ROWS = "divide-y divide-hairline";
const PILL =
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset";

function Row({
  label,
  index,
  animate = false,
  children,
}: {
  label: string;
  index: number;
  animate?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid gap-2 py-5 first:pt-0 last:pb-0 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-6",
        animate && "reveal",
      )}
      style={{ "--reveal-index": index } as CSSProperties}
    >
      <dt className="text-sm font-medium text-ink-muted sm:pt-1.5">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

/** The HS code drawn as its real structure: 4-digit heading, then the subheading. */
function HsCode({ code }: { code: string }) {
  const [heading, subheading] = code.split(".");
  return (
    <span className="inline-flex items-baseline rounded-lg border border-accent/25 bg-accent-surface px-3 py-1.5 font-mono text-xl font-semibold tracking-tight tabular-nums">
      {heading}
      <span className="text-accent">.{subheading}</span>
    </span>
  );
}

function ResultRows({ result }: { result: CustomsResult }) {
  const rate = Number.parseFloat(result.estimatedDuty);
  const digits = result.hsCode.replace(".", "");

  return (
    <dl className={ROWS}>
      <Row label={LABELS.hs} index={0} animate>
        <HsCode code={result.hsCode} />
        <p className="mt-2 text-sm">{result.hsDescription}</p>
        <p className="mt-1 text-xs text-ink-muted">
          Chapter {digits.slice(0, 2)} · Heading {digits.slice(0, 4)}
        </p>
      </Row>

      <Row label={LABELS.duty} index={1} animate>
        <p className="text-2xl font-semibold tracking-tight tabular-nums">{result.estimatedDuty}</p>
        <p className="mt-1 text-sm text-ink-muted">
          {Number.isFinite(rate) ? `≈ $${rate.toFixed(2)} per $100 of declared value` : "Of declared value"}
          {` into ${countryName(result.country)}`}
        </p>
      </Row>

      <Row label={LABELS.docs} index={2} animate>
        <ul className="flex flex-wrap gap-2">
          {result.requiredDocuments.map((doc) => (
            <li
              key={doc}
              className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-ground py-1 pr-2.5 pl-2 text-[13px] font-medium"
            >
              <FileText aria-hidden className="size-3.5 text-ink-muted" />
              {doc}
            </li>
          ))}
        </ul>
      </Row>
    </dl>
  );
}

/** Same structure and rhythm as ResultRows, so nothing shifts when the result lands. */
function SkeletonRows() {
  return (
    <dl className={ROWS} aria-hidden>
      <Row label={LABELS.hs} index={0}>
        <div className="skeleton h-[42px] w-36 rounded-lg" />
        <div className="skeleton mt-3 h-3.5 w-56 max-w-full rounded" />
        <div className="skeleton mt-2 h-3 w-32 rounded" />
      </Row>
      <Row label={LABELS.duty} index={1}>
        <div className="skeleton h-7 w-20 rounded" />
        <div className="skeleton mt-2.5 h-3.5 w-64 max-w-full rounded" />
      </Row>
      <Row label={LABELS.docs} index={2}>
        <div className="flex gap-2">
          <div className="skeleton h-[28px] w-36 rounded-md" />
          <div className="skeleton h-[28px] w-24 rounded-md" />
        </div>
      </Row>
    </dl>
  );
}

/** Static outline of what the panel will contain, shown before the first run. */
function IdleRows() {
  const block = "bg-hairline/60";
  return (
    <dl className={ROWS} aria-hidden>
      <Row label={LABELS.hs} index={0}>
        <div className={cn("h-[42px] w-36 rounded-lg", block)} />
        <div className={cn("mt-3 h-3.5 w-56 max-w-full rounded", block)} />
      </Row>
      <Row label={LABELS.duty} index={1}>
        <div className={cn("h-7 w-20 rounded", block)} />
        <div className={cn("mt-2.5 h-3.5 w-64 max-w-full rounded", block)} />
      </Row>
      <Row label={LABELS.docs} index={2}>
        <div className="flex gap-2">
          <div className={cn("h-[28px] w-36 rounded-md", block)} />
          <div className={cn("h-[28px] w-24 rounded-md", block)} />
        </div>
      </Row>
    </dl>
  );
}

function StatusPill({ outcome, stale }: { outcome: Outcome; stale: boolean }) {
  if (outcome.status === "pending") {
    return (
      <span className={cn(PILL, "bg-accent-surface text-accent ring-accent/20")}>
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full rounded-full bg-accent opacity-60 motion-safe:animate-ping" />
          <span className="relative inline-flex size-2 rounded-full bg-accent" />
        </span>
        Analyzing
      </span>
    );
  }
  if (outcome.status === "success" && stale) {
    return <span className={cn(PILL, "bg-ground text-ink-muted ring-hairline-strong")}>Inputs changed</span>;
  }
  return null;
}

export function CustomsResults({ outcome, stale }: { outcome: Outcome; stale: boolean }) {
  const pending = outcome.status === "pending";

  return (
    <section
      aria-labelledby="customs-data-heading"
      className="overflow-hidden rounded-xl border border-hairline bg-surface shadow-card"
    >
      <div className="flex min-h-13 items-center justify-between gap-3 border-b border-hairline px-6 py-3">
        <h2 id="customs-data-heading" className="text-sm font-semibold tracking-tight">
          Customs data
        </h2>
        <StatusPill outcome={outcome} stale={stale} />
      </div>

      <div aria-live="polite" aria-busy={pending} className="p-6">
        {outcome.status === "idle" && (
          <>
            <p className="mb-6 text-sm text-ink-muted">
              Describe a product and choose a destination. Its HS code, duty estimate and required
              documents will appear here.
            </p>
            <IdleRows />
          </>
        )}

        {outcome.status === "pending" && (
          <>
            <p className="mb-6 text-sm text-ink-muted">
              Analyzing your description for shipping to {countryName(outcome.country)}…
            </p>
            <SkeletonRows />
          </>
        )}

        {outcome.status === "success" && (
          <div className={cn("transition-opacity duration-200", stale && "opacity-50")}>
            <ResultRows result={outcome.data} />
          </div>
        )}

        {outcome.status === "error" && (
          <div
            role="alert"
            className="flex gap-3 rounded-lg border border-danger-border bg-danger-surface p-4 text-sm"
          >
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" />
            <div>
              <p className="font-medium text-danger">Couldn&apos;t generate customs data</p>
              <p className="mt-1 text-danger">{outcome.message}</p>
            </div>
          </div>
        )}
      </div>

      {outcome.status === "success" && (
        <div className="flex flex-col gap-3 border-t border-hairline bg-ground px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="grid gap-1 text-[13px]">
            <p className="text-ink-muted">
              The invoice uses placeholder party details. Verify every field before filing.
            </p>
            {!outcome.saved && (
              <p className="flex items-center gap-1.5 text-danger">
                <CircleAlert aria-hidden className="size-3.5 shrink-0" />
                Not saved to your shipment history. Generate again to retry.
              </p>
            )}
          </div>
          <InvoiceDownload description={outcome.description} result={outcome.data} logo={outcome.logo} />
        </div>
      )}
    </section>
  );
}
