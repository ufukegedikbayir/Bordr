import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ArrowRight, CircleAlert, FileText, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { countryName, type CountryCode, type CustomsResult, type LineClassification } from "@/services/customs/constants";
import type { ShipmentDocuments } from "@/services/customs/documents";
import type { ShipmentFormValues } from "@/services/customs/shipment-input";

import { DocumentList } from "./document-list";

export type Outcome =
  | { status: "idle" }
  | { status: "pending"; country: CountryCode }
  | {
      status: "success";
      data: CustomsResult;
      /** Null when the shipment couldn't be saved; documents need its saved number. */
      documents: ShipmentDocuments | null;
      logo: string | null;
      /** The values this result was generated from, to detect later edits. */
      submitted: ShipmentFormValues;
    }
  | { status: "error"; message: string; settingsLink?: boolean };

const LABELS = {
  hs: "Suggested HS code",
  hsLines: "Suggested HS codes",
  duty: "Estimated import duty",
  docs: "Required documents",
  notes: "Compliance notes",
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
function HsCode({ code, size = "lg" }: { code: string; size?: "lg" | "sm" }) {
  const [heading, subheading] = code.split(".");
  return (
    <span
      className={cn(
        "inline-flex items-baseline border border-accent/25 bg-accent-surface font-mono font-semibold tracking-tight tabular-nums",
        size === "lg" ? "rounded-lg px-3 py-1.5 text-xl" : "rounded-md px-1.5 py-0.5 text-[13px]",
      )}
    >
      {heading}
      <span className="text-accent">.{subheading}</span>
    </span>
  );
}

const money = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Duty across all lines, each line's rate weighted by its value. Null if a rate is unreadable. */
function weightedDuty(lines: LineClassification[]) {
  const value = lines.reduce((sum, line) => sum + line.value, 0);
  let duty = 0;
  for (const line of lines) {
    const rate = Number.parseFloat(line.estimatedDuty);
    if (!Number.isFinite(rate)) return null;
    duty += (line.value * rate) / 100;
  }
  return { value, duty, rate: value > 0 ? (duty / value) * 100 : 0 };
}

function ResultRows({ result }: { result: CustomsResult }) {
  const single = result.lines.length === 1 ? result.lines[0]! : null;
  const total = weightedDuty(result.lines);

  return (
    <dl className={ROWS}>
      <Row label={single ? LABELS.hs : LABELS.hsLines} index={0} animate>
        {single ? (
          <>
            <HsCode code={single.hsCode} />
            <p className="mt-2 text-sm">{single.hsDescription}</p>
            <p className="mt-1 text-xs text-ink-muted">
              Chapter {single.hsCode.slice(0, 2)} · Heading {single.hsCode.slice(0, 4)}
            </p>
          </>
        ) : (
          <ol className="grid gap-3">
            {result.lines.map((line, i) => (
              <li key={i} className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] gap-x-2 gap-y-1">
                <span className="pt-0.5 text-xs font-semibold text-ink-muted tabular-nums">{i + 1}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" title={line.description}>
                    {line.description}
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-xs text-ink-muted">
                    <HsCode code={line.hsCode} size="sm" />
                    <span className="truncate">{line.hsDescription}</span>
                  </p>
                </div>
                <span className="pt-0.5 text-sm font-semibold tabular-nums">{line.estimatedDuty}</span>
              </li>
            ))}
          </ol>
        )}
      </Row>

      <Row label={LABELS.duty} index={1} animate>
        <p className="text-2xl font-semibold tracking-tight tabular-nums">
          {single ? single.estimatedDuty : total ? `${total.rate.toFixed(1)}%` : "Varies"}
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          {total
            ? `≈ ${money.format(total.duty)} ${result.currency} on ${money.format(total.value)} ${result.currency} declared value`
            : "Of declared value"}
          {` into ${countryName(result.country)}`}
          {!single && total ? ", weighted by each item's value" : ""}
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

      {result.complianceNotes.length > 0 && (
        <Row label={LABELS.notes} index={3} animate>
          <ul className="grid gap-2">
            {result.complianceNotes.map((note) => (
              <li key={note} className="flex gap-2 text-sm">
                <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-muted" />
                {note}
              </li>
            ))}
          </ul>
        </Row>
      )}
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
              Fill in the shipment details. Each item&apos;s HS code, the duty estimate and compliance notes will appear
              here, with the invoice, packing list, CMR and certificate of origin application.
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
              {outcome.settingsLink && (
                <Link
                  href="/settings"
                  className="mt-2 inline-flex items-center gap-1 font-medium text-danger underline-offset-2 hover:underline"
                >
                  Open company profile
                  <ArrowRight aria-hidden className="size-3.5" />
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      {outcome.status === "success" && (
        <div className="grid gap-4 border-t border-hairline bg-ground px-6 py-5">
          {outcome.documents ? (
            <>
              <div className="grid gap-1 text-[13px]">
                <p className="font-medium text-ink">
                  Shipment <span className="tabular-nums">{outcome.documents.invoice.invoiceNumber}</span> saved to your
                  history
                </p>
                <p className="text-ink-muted">
                  Every document is built from the same record. Check each figure before you sign.
                </p>
              </div>
              <DocumentList documents={outcome.documents} logo={outcome.logo} />
            </>
          ) : (
            <p className="flex items-center gap-1.5 text-[13px] text-danger">
              <CircleAlert aria-hidden className="size-3.5 shrink-0" />
              Not saved, so no documents were issued. Generate again to retry.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
