import { Copy, Plus, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { MAX_PACKAGES, MAX_PAYLOAD_KG, MAX_PAYLOAD_M3, PACKAGE_TYPES } from "@/services/customs/freight";
import {
  SHIPMENT_MASKS,
  packagePath,
  type FieldErrors,
  type LineFormValues,
  type PackageField,
  type PackageFormValues,
} from "@/services/customs/shipment-input";

import { FormField, Select, a11y, firstError, iconButton, input, masked, numeric } from "./form-controls";

export type PackagesEditorProps = {
  packages: PackageFormValues[];
  /** The shipment's items, to choose which one each package carries. */
  lines: LineFormValues[];
  errors: FieldErrors;
  onChange: (index: number, field: PackageField, value: string) => void;
  onAdd: () => void;
  onDuplicate: (index: number) => void;
  onRemove: (index: number) => void;
  onBlurField: (path: string) => void;
};

/** Lenient parse for the live totals: "1 234,5" -> 1234.5; anything else -> 0. */
function num(value: string) {
  const n = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const kg = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 3 });
const m3 = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Capacity({ label, value, max, unit }: { label: string; value: number; max: number; unit: string }) {
  const share = Math.min(1, value / max);
  const over = value > max;
  return (
    <div className="grid gap-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-ink-muted">{label}</span>
        <span className={cn("font-medium tabular-nums", over && "text-danger")}>
          {unit === "kg" ? kg.format(value) : m3.format(value)} {unit}
          <span className="font-normal text-ink-muted"> / {max.toLocaleString("en-GB")}</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-hairline" aria-hidden>
        <div
          className={cn("h-full rounded-full transition-[width] duration-200", over ? "bg-danger" : "bg-accent")}
          style={{ width: `${share * 100}%` }}
        />
      </div>
    </div>
  );
}

/** Live totals: exactly what the database will compute from these packages. */
function Totals({ packages }: { packages: PackageFormValues[] }) {
  const quantity = packages.reduce((sum, p) => sum + num(p.quantity), 0);
  const net = packages.reduce((sum, p) => sum + num(p.netWeightKg), 0);
  const gross = packages.reduce((sum, p) => sum + num(p.grossWeightKg), 0);
  const volume = packages.reduce((sum, p) => sum + (num(p.lengthCm) * num(p.widthCm) * num(p.heightCm)) / 1_000_000, 0);

  return (
    <div className="grid gap-4 rounded-lg border border-hairline bg-ground p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)]">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        {[
          ["Packages", packages.length.toLocaleString("en-GB")],
          ["Quantity", `${quantity.toLocaleString("en-GB")} pcs`],
          ["Net weight", `${kg.format(net)} kg`],
          ["Gross weight", `${kg.format(gross)} kg`],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs whitespace-nowrap text-ink-muted">{label}</dt>
            <dd className="font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-2.5" aria-label="Share of one truck's capacity">
        <Capacity label="Truck payload" value={gross} max={MAX_PAYLOAD_KG} unit="kg" />
        <Capacity label="Truck volume" value={volume} max={MAX_PAYLOAD_M3} unit="m³" />
      </div>
    </div>
  );
}

/** "2 · Thinner for alkyd paint…", so the picker reads like the items above it. */
function itemLabel(line: LineFormValues, index: number) {
  const text = line.description.trim();
  return `${index + 1} · ${text ? (text.length > 48 ? `${text.slice(0, 47)}…` : text) : "Not described yet"}`;
}

export function PackagesEditor({ packages, lines, errors, onChange, onAdd, onDuplicate, onRemove, onBlurField }: PackagesEditorProps) {
  const listError = firstError(errors, "packages");
  const full = packages.length >= MAX_PACKAGES;
  // With one item every package carries it; the picker appears once there's a choice.
  const chooseItem = lines.length > 1;

  return (
    <div className="grid gap-4">
      <ol className="grid gap-3">
        {packages.map((p, index) => {
          const path = (field: PackageField) => packagePath(index, field);
          const error = (field: PackageField) => firstError(errors, path(field));
          const bind = (field: PackageField) => ({
            ...a11y(path(field), error(field)),
            value: p[field],
            onChange: (event: Parameters<typeof masked>[0]) => onChange(index, field, masked(event, SHIPMENT_MASKS[field])),
            // Net vs gross is one rule: leaving either re-checks the net field.
            onBlur: () => {
              onBlurField(path(field));
              if (field === "grossWeightKg") onBlurField(path("netWeightKg"));
            },
          });

          return (
            <li key={index} className="rounded-lg border border-hairline bg-surface p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold tracking-tight">
                  Package <span className="tabular-nums">{index + 1}</span>
                </p>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => onDuplicate(index)}
                    disabled={full}
                    aria-label={`Duplicate package ${index + 1}`}
                    title="Duplicate as a new package at the end, with the next marks number"
                    className={iconButton}
                  >
                    <Copy aria-hidden className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(index)}
                    disabled={packages.length === 1}
                    aria-label={`Remove package ${index + 1}`}
                    title="Remove"
                    className={iconButton}
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-12">
                {chooseItem && (
                  <FormField path={path("line")} label="Item carried" error={error("line")} className="col-span-2 sm:col-span-12">
                    <Select {...bind("line")}>
                      <option value="" disabled>
                        Choose an item
                      </option>
                      {lines.map((line, i) => (
                        <option key={i} value={String(i + 1)}>
                          {itemLabel(line, i)}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                )}
                <FormField path={path("packageType")} label="Type" error={error("packageType")} className="col-span-2 sm:col-span-3">
                  <Select {...bind("packageType")}>
                    {PACKAGE_TYPES.map(({ code, name }) => (
                      <option key={code} value={code}>
                        {name}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField path={path("marks")} label="Marks and numbers" error={error("marks")} className="col-span-2 sm:col-span-6">
                  <input {...bind("marks")} maxLength={60} spellCheck={false} placeholder="e.g. RF-2610-01" className={cn(input, "font-mono")} />
                </FormField>
                <FormField path={path("quantity")} label="Pieces" error={error("quantity")} className="col-span-2 sm:col-span-3">
                  <input {...bind("quantity")} inputMode="numeric" className={numeric} />
                </FormField>
                <FormField path={path("netWeightKg")} label="Net kg" error={error("netWeightKg")} className="sm:col-span-3">
                  <input {...bind("netWeightKg")} inputMode="decimal" className={numeric} />
                </FormField>
                <FormField path={path("grossWeightKg")} label="Gross kg" error={error("grossWeightKg")} className="sm:col-span-3">
                  <input {...bind("grossWeightKg")} inputMode="decimal" className={numeric} />
                </FormField>
                <FormField path={path("lengthCm")} label="Length cm" error={error("lengthCm")} className="sm:col-span-2">
                  <input {...bind("lengthCm")} inputMode="numeric" className={numeric} />
                </FormField>
                <FormField path={path("widthCm")} label="Width cm" error={error("widthCm")} className="sm:col-span-2">
                  <input {...bind("widthCm")} inputMode="numeric" className={numeric} />
                </FormField>
                <FormField path={path("heightCm")} label="Height cm" error={error("heightCm")} className="col-span-2 sm:col-span-2">
                  <input {...bind("heightCm")} inputMode="numeric" className={numeric} />
                </FormField>
              </div>
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        onClick={onAdd}
        disabled={full}
        className={cn(
          "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-dashed border-hairline-strong text-sm font-medium text-ink-muted",
          "outline-none transition-colors duration-150 enabled:hover:border-ink-muted enabled:hover:text-ink",
          "focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        <Plus aria-hidden className="size-4" />
        {full ? `${MAX_PACKAGES} packages is the maximum` : "Add package"}
      </button>

      {listError && (
        <p id="shipment-packages-error" role="alert" tabIndex={-1} className="text-[13px] font-medium text-danger outline-none">
          {listError}
        </p>
      )}

      <Totals packages={packages} />
    </div>
  );
}
