import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, PackageOpen } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils/cn";
import { COUNTRIES } from "@/services/customs/constants";
import { HISTORY_LIMIT, type ShipmentRow } from "@/services/shipments/queries";

const COLUMNS = [
  { label: "Date", className: "w-36" },
  { label: "Description" },
  { label: "Destination", className: "w-44" },
  { label: "HS code", className: "w-32" },
  { label: "Duty", className: "w-24 text-right" },
] as const;

// Edge cells get the card's 24px inset; inner cells 16px.
const CELL = "px-4 first:pl-6 last:pr-6";

// Formatted on the server, so pinned to UTC and labelled as such.
const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const timeFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

function Card({ title, meta, children }: { title: string; meta?: ReactNode; children: ReactNode }) {
  return (
    <section
      aria-labelledby="history-heading"
      className="min-w-0 overflow-hidden rounded-xl border border-hairline bg-surface shadow-card"
    >
      <div className="flex min-h-13 items-center justify-between gap-3 border-b border-hairline px-6 py-3">
        <h2 id="history-heading" className="text-sm font-semibold tracking-tight">
          {title}
        </h2>
        {meta && <p className="text-[13px] text-ink-muted tabular-nums">{meta}</p>}
      </div>
      {children}
    </section>
  );
}

function TableHead() {
  return (
    <thead className="border-b border-hairline bg-ground/70">
      <tr>
        {COLUMNS.map(({ label, ...col }) => (
          <th
            key={label}
            scope="col"
            className={cn(CELL, "h-9 text-left text-xs font-medium text-ink-muted", "className" in col && col.className)}
          >
            {label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function HsCode({ code }: { code: string }) {
  const [heading, subheading] = code.split(".");
  return (
    <span className="inline-flex items-baseline rounded-md border border-hairline bg-ground px-1.5 py-0.5 font-mono text-[13px] font-medium tabular-nums">
      {heading}
      {subheading && <span className="text-ink-muted">.{subheading}</span>}
    </span>
  );
}

function ShipmentTableRow({ shipment }: { shipment: ShipmentRow }) {
  const created = new Date(shipment.created_at);
  const destination = COUNTRIES.find(({ code }) => code === shipment.country);

  return (
    <tr className="border-b border-hairline transition-colors duration-150 last:border-0 hover:bg-ground/60">
      <td className={cn(CELL, "py-3 align-top whitespace-nowrap")}>
        <time dateTime={shipment.created_at} className="block">
          {dateFormat.format(created)}
          <span className="mt-0.5 block text-xs text-ink-muted tabular-nums">
            {timeFormat.format(created)} UTC
          </span>
        </time>
      </td>
      <td className={cn(CELL, "max-w-0 py-3 align-top")}>
        <p className="truncate font-medium" title={shipment.description}>
          {shipment.description}
        </p>
        <p className="mt-0.5 truncate text-xs text-ink-muted" title={shipment.hs_description}>
          {shipment.hs_description}
        </p>
      </td>
      <td className={cn(CELL, "py-3 align-top whitespace-nowrap")}>
        {destination?.name ?? shipment.country}
        <span className="ml-1.5 text-xs text-ink-muted">{shipment.country}</span>
      </td>
      <td className={cn(CELL, "py-2.5 align-top")}>
        <HsCode code={shipment.hs_code} />
      </td>
      <td className={cn(CELL, "py-3 text-right align-top font-medium tabular-nums")}>
        {shipment.estimated_duty}
      </td>
    </tr>
  );
}

export function ShipmentTable({ shipments }: { shipments: ShipmentRow[] }) {
  if (shipments.length === 0) return <EmptyHistory />;

  const count = shipments.length;
  const meta =
    count >= HISTORY_LIMIT ? `Latest ${HISTORY_LIMIT}` : `${count} ${count === 1 ? "shipment" : "shipments"}`;

  return (
    <Card title="History" meta={meta}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-sm">
          <caption className="sr-only">Your shipments, newest first</caption>
          <TableHead />
          <tbody>
            {shipments.map((shipment) => (
              <ShipmentTableRow key={shipment.id} shipment={shipment} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function EmptyHistory() {
  return (
    <Card title="History">
      <div className="flex flex-col items-center px-6 py-16 text-center">
        <span className="grid size-10 place-items-center rounded-lg border border-hairline bg-ground text-ink-muted">
          <PackageOpen aria-hidden className="size-4" />
        </span>
        <h3 className="mt-4 text-base font-semibold tracking-tight">No shipments yet</h3>
        <p className="mt-1.5 max-w-sm text-sm text-pretty text-ink-muted">
          Classify a product and its HS code, destination and duty estimate are saved here
          automatically.
        </p>
        <Link
          href="/shipments/new"
          className="group mt-5 inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-ink underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          Classify your first product
          <ArrowRight
            aria-hidden
            className="size-4 transition-transform duration-150 motion-safe:group-hover:translate-x-0.5"
          />
        </Link>
      </div>
    </Card>
  );
}

export function HistoryError() {
  return (
    <Card title="History">
      <div className="p-6">
        <Alert>
          <p className="font-medium">Couldn&apos;t load your shipment history.</p>
          <p className="mt-0.5">Refresh the page to try again. Your saved shipments are not affected.</p>
        </Alert>
      </div>
    </Card>
  );
}

const SKELETON_ROWS = ["w-3/5", "w-2/5", "w-1/2", "w-3/5", "w-1/3"];

/** Same frame and rhythm as the table, so nothing shifts when data lands. */
export function HistorySkeleton() {
  return (
    <Card title="History">
      <div aria-hidden className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-sm">
          <TableHead />
          <tbody>
            {SKELETON_ROWS.map((width, i) => (
              <tr key={i} className="border-b border-hairline last:border-0">
                <td className={cn(CELL, "py-3")}>
                  <div className="skeleton h-3.5 w-24 rounded" />
                  <div className="skeleton mt-2 h-3 w-16 rounded" />
                </td>
                <td className={cn(CELL, "py-3")}>
                  <div className={cn("skeleton h-3.5 rounded", width)} />
                  <div className="skeleton mt-2 h-3 w-1/3 rounded" />
                </td>
                <td className={cn(CELL, "py-3")}>
                  <div className="skeleton h-3.5 w-24 rounded" />
                </td>
                <td className={cn(CELL, "py-3")}>
                  <div className="skeleton h-6 w-18 rounded-md" />
                </td>
                <td className={cn(CELL, "py-3")}>
                  <div className="skeleton ml-auto h-3.5 w-10 rounded" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p role="status" className="sr-only">
        Loading shipment history…
      </p>
    </Card>
  );
}
