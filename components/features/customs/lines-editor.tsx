import type { KeyboardEvent, Ref } from "react";
import { Plus, Trash2 } from "lucide-react";

import { controlClass } from "@/components/ui/field";
import { cn } from "@/lib/utils/cn";
import { EXAMPLE_PRODUCTS, MAX_DESCRIPTION_LENGTH, MAX_LINES } from "@/services/customs/constants";
import { WORLD_COUNTRIES } from "@/services/customs/invoice";
import {
  SHIPMENT_MASKS,
  linePath,
  type FieldErrors,
  type LineField,
  type LineFormValues,
  type PackageFormValues,
} from "@/services/customs/shipment-input";

import { FormField, Select, a11y, firstError, iconButton, masked, numeric } from "./form-controls";

export type LinesEditorProps = {
  lines: LineFormValues[];
  packages: PackageFormValues[];
  currency: string;
  errors: FieldErrors;
  /** The first item's description, so the page can focus it. */
  textareaRef: Ref<HTMLTextAreaElement>;
  onChange: (index: number, field: LineField, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onBlurField: (path: string) => void;
  onSubmitShortcut: () => void;
};

/** Lenient parse for live figures: "1 234,5" -> 1234.5; anything else -> 0. */
function num(value: string) {
  const n = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const amount = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const kg = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 3 });

/** What the documents will print for this item, from the packages assigned to it. */
function LineFigures({ index, line, packages, currency }: { index: number; line: LineFormValues; packages: PackageFormValues[]; currency: string }) {
  const own = packages.filter((p) => p.line === String(index + 1));
  const quantity = own.reduce((sum, p) => sum + num(p.quantity), 0);
  const net = own.reduce((sum, p) => sum + num(p.netWeightKg), 0);
  const value = quantity * num(line.unitPrice);
  return (
    <p className="text-xs text-ink-muted tabular-nums">
      {own.length === 0
        ? "No package carries this item yet."
        : `${own.length} ${own.length === 1 ? "package" : "packages"} · ${quantity.toLocaleString("en-GB")} pcs · ${kg.format(net)} kg net · ${amount.format(value)} ${currency}`}
    </p>
  );
}

export function LinesEditor({
  lines,
  packages,
  currency,
  errors,
  textareaRef,
  onChange,
  onAdd,
  onRemove,
  onBlurField,
  onSubmitShortcut,
}: LinesEditorProps) {
  const full = lines.length >= MAX_LINES;
  const listError = firstError(errors, "lines");
  const last = lines.length - 1;

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      onSubmitShortcut();
    }
  }

  return (
    <div className="grid gap-3">
      <ol className="grid gap-3">
        {lines.map((line, index) => {
          const path = (field: LineField) => linePath(index, field);
          const error = (field: LineField) => firstError(errors, path(field));
          const itemError = firstError(errors, linePath(index));
          const bind = (field: LineField, hint = false) => ({
            ...a11y(path(field), error(field), hint),
            value: line[field],
            onChange: (event: Parameters<typeof masked>[0]) => onChange(index, field, masked(event, SHIPMENT_MASKS[field])),
            onBlur: () => onBlurField(path(field)),
          });

          return (
            <li key={index} className="rounded-lg border border-hairline bg-surface p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold tracking-tight">
                  Item <span className="tabular-nums">{index + 1}</span>
                </p>
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  disabled={lines.length === 1}
                  aria-label={`Remove item ${index + 1}`}
                  title="Remove"
                  className={iconButton}
                >
                  <Trash2 aria-hidden className="size-4" />
                </button>
              </div>

              <div className="grid gap-3">
                <FormField
                  path={path("description")}
                  label="Description of goods"
                  hint={index === 0 ? "Plain trade description: material, type and use." : undefined}
                  error={error("description")}
                >
                  <textarea
                    ref={index === 0 ? textareaRef : undefined}
                    {...bind("description", index === 0)}
                    rows={2}
                    maxLength={MAX_DESCRIPTION_LENGTH}
                    onKeyDown={handleKeyDown}
                    placeholder={index === 0 ? "e.g. Industrial alkyd paint, solvent-based, in 20 l steel drums" : undefined}
                    className={cn(controlClass, "min-h-16 resize-y py-2.5 leading-[1.375rem]")}
                  />
                </FormField>

                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
                  <FormField path={path("unitPrice")} label={`Unit price (${currency})`} error={error("unitPrice")}>
                    <input {...bind("unitPrice")} inputMode="decimal" placeholder="0.00" className={numeric} />
                  </FormField>
                  <FormField path={path("originCountry")} label="Country of origin" error={error("originCountry")}>
                    <Select {...bind("originCountry")}>
                      <option value="" disabled>
                        Choose a country
                      </option>
                      {WORLD_COUNTRIES.map(({ code, name }) => (
                        <option key={code} value={code}>
                          {name}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </div>

                {itemError ? (
                  <p id={`shipment-lines-${index}-error`} role="alert" tabIndex={-1} className="text-[13px] font-medium text-danger outline-none">
                    {itemError}
                  </p>
                ) : (
                  <LineFigures index={index} line={line} packages={packages} currency={currency} />
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {lines[last]?.description === "" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-ink-muted">Try</span>
          {EXAMPLE_PRODUCTS.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => onChange(last, "description", example)}
              className={cn(
                "h-8 rounded-full border border-hairline bg-surface px-3 text-[13px] text-ink-muted",
                "transition-colors duration-150 enabled:hover:border-hairline-strong enabled:hover:text-ink",
                "outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                "disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              {example}
            </button>
          ))}
        </div>
      )}

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
        {full ? `${MAX_LINES} items is the maximum` : "Add item"}
      </button>

      {listError && (
        <p id="shipment-lines-error" role="alert" tabIndex={-1} className="text-[13px] font-medium text-danger outline-none">
          {listError}
        </p>
      )}

      <p className="text-[13px] text-ink-muted">
        Origin is where the goods were made or last substantially transformed, not necessarily where they ship from.
      </p>
    </div>
  );
}
