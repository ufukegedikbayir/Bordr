import type { ComponentProps, FormEvent, KeyboardEvent, ReactNode, Ref } from "react";
import { ChevronDown, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { cn } from "@/lib/utils/cn";
import { COUNTRIES, EXAMPLE_PRODUCTS, MAX_DESCRIPTION_LENGTH } from "@/services/customs/constants";
import {
  CURRENCIES,
  INCOTERMS,
  WORLD_COUNTRIES,
  type ShipmentFormValues,
} from "@/services/customs/invoice";

export type FieldKey = keyof ShipmentFormValues;
export type FieldErrors = Partial<Record<FieldKey, string[]>>;

/** Stable ids, so the parent can focus the first invalid field. */
export const fieldId = (key: FieldKey) => `shipment-${key}`;

type ShipmentFormProps = {
  values: ShipmentFormValues;
  errors: FieldErrors;
  pending: boolean;
  textareaRef: Ref<HTMLTextAreaElement>;
  onChange: (key: FieldKey, value: string) => void;
  onSubmit: () => void;
};

function FormField({
  name,
  label,
  hint,
  error,
  className,
  children,
}: {
  name: FieldKey;
  label: string;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      <label htmlFor={fieldId(name)} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${fieldId(name)}-error`} className="text-[13px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${fieldId(name)}-hint`} className="text-[13px] text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** aria wiring shared by every control: invalid state and the message that explains it. */
function a11y(name: FieldKey, error: string | undefined, hasHint = false) {
  return {
    id: fieldId(name),
    name,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${fieldId(name)}-error` : hasHint ? `${fieldId(name)}-hint` : undefined,
  } as const;
}

function Select({ className, children, ...props }: ComponentProps<"select">) {
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

function Fieldset({ legend, description, children }: { legend: string; description: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-4 border-t border-hairline pt-6 first:border-t-0 first:pt-0">
      <div>
        <legend className="text-sm font-semibold tracking-tight">{legend}</legend>
        <p className="mt-0.5 text-[13px] text-ink-muted">{description}</p>
      </div>
      {children}
    </fieldset>
  );
}

const input = cn(controlClass, "h-10");
const numeric = cn(input, "tabular-nums");

export function ShipmentForm({ values, errors, pending, textareaRef, onChange, onSubmit }: ShipmentFormProps) {
  const error = (key: FieldKey) => errors[key]?.[0];
  const bind = (key: FieldKey) => ({
    value: values[key],
    onChange: (event: { target: { value: string } }) => onChange(key, event.target.value),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      onSubmit();
    }
  }

  return (
    <section
      aria-labelledby="shipment-details-heading"
      className="overflow-hidden rounded-xl border border-hairline bg-surface shadow-card"
    >
      <div className="flex min-h-13 items-center border-b border-hairline px-6 py-3">
        <h2 id="shipment-details-heading" className="text-sm font-semibold tracking-tight">
          Shipment details
        </h2>
      </div>

      <form onSubmit={handleSubmit} noValidate className="grid gap-6 p-6">
        <fieldset disabled={pending} className="contents">
          <Fieldset legend="Goods" description="What you're shipping, as it should appear on the invoice.">
            <FormField
              name="description"
              label="Description of goods"
              hint="Plain trade description: material, type and use."
              error={error("description")}
            >
              <textarea
                ref={textareaRef}
                {...a11y("description", error("description"), true)}
                {...bind("description")}
                rows={3}
                maxLength={MAX_DESCRIPTION_LENGTH}
                onKeyDown={handleKeyDown}
                placeholder="e.g. Men's wallets of full-grain cowhide leather"
                className={cn(controlClass, "min-h-20 resize-y py-2.5 leading-[1.375rem]")}
              />
            </FormField>

            <div className="-mt-1 flex flex-wrap items-center gap-2">
              <span className="text-[13px] text-ink-muted">Try</span>
              {EXAMPLE_PRODUCTS.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => onChange("description", example)}
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

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField name="quantity" label="Quantity (pcs)" error={error("quantity")}>
                <input {...a11y("quantity", error("quantity"))} {...bind("quantity")} inputMode="numeric" className={numeric} />
              </FormField>
              <FormField name="unitPrice" label="Unit price" error={error("unitPrice")}>
                <input {...a11y("unitPrice", error("unitPrice"))} {...bind("unitPrice")} inputMode="decimal" placeholder="0.00" className={numeric} />
              </FormField>
              <FormField name="currency" label="Currency" error={error("currency")}>
                <Select {...a11y("currency", error("currency"))} {...bind("currency")}>
                  {CURRENCIES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>

            <FormField
              name="originCountry"
              label="Country of origin"
              hint="Where the goods were made or last substantially transformed. Not necessarily where you ship from."
              error={error("originCountry")}
            >
              <Select {...a11y("originCountry", error("originCountry"), true)} {...bind("originCountry")}>
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
          </Fieldset>

          <Fieldset legend="Delivery" description="Terms of delivery and what the truck carries.">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField name="country" label="Destination country" error={error("country")}>
                <Select {...a11y("country", error("country"))} {...bind("country")}>
                  {COUNTRIES.map(({ code, name }) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField name="incoterm" label="Incoterms® 2020" error={error("incoterm")}>
                <Select {...a11y("incoterm", error("incoterm"))} {...bind("incoterm")}>
                  <option value="" disabled>
                    Choose a rule
                  </option>
                  {INCOTERMS.map(({ code, name }) => (
                    <option key={code} value={code}>
                      {code} – {name}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>

            <FormField
              name="incotermPlace"
              label="Named place"
              hint="The place the Incoterm refers to, e.g. the consignee's warehouse address or town."
              error={error("incotermPlace")}
            >
              <input {...a11y("incotermPlace", error("incotermPlace"), true)} {...bind("incotermPlace")} placeholder="e.g. Berlin, Lagerstraße 5" className={input} />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField name="packageCount" label="Packages" error={error("packageCount")}>
                <input {...a11y("packageCount", error("packageCount"))} {...bind("packageCount")} inputMode="numeric" className={numeric} />
              </FormField>
              <FormField name="grossWeightKg" label="Gross weight (kg)" error={error("grossWeightKg")}>
                <input {...a11y("grossWeightKg", error("grossWeightKg"))} {...bind("grossWeightKg")} inputMode="decimal" className={numeric} />
              </FormField>
              <FormField name="netWeightKg" label="Net weight (kg)" error={error("netWeightKg")}>
                <input {...a11y("netWeightKg", error("netWeightKg"))} {...bind("netWeightKg")} inputMode="decimal" className={numeric} />
              </FormField>
            </div>
          </Fieldset>

          <Fieldset legend="Consignee" description="Who receives the goods in the destination country.">
            <FormField name="consigneeName" label="Company name" error={error("consigneeName")}>
              <input {...a11y("consigneeName", error("consigneeName"))} {...bind("consigneeName")} autoComplete="organization" className={input} />
            </FormField>
            <FormField
              name="consigneeAddress"
              label="Address"
              hint="Street, postal code and city. The country is the destination above."
              error={error("consigneeAddress")}
            >
              <textarea
                {...a11y("consigneeAddress", error("consigneeAddress"), true)}
                {...bind("consigneeAddress")}
                rows={3}
                maxLength={400}
                className={cn(controlClass, "resize-y py-2.5 leading-[1.375rem]")}
              />
            </FormField>
            <FormField
              name="consigneeTaxId"
              label="VAT / Tax ID or EORI (optional)"
              hint="Required by many destinations to clear the goods in the consignee's name."
              error={error("consigneeTaxId")}
            >
              <input {...a11y("consigneeTaxId", error("consigneeTaxId"), true)} {...bind("consigneeTaxId")} className={cn(input, "uppercase")} />
            </FormField>
          </Fieldset>
        </fieldset>

        <Button type="submit" loading={pending} className="w-full">
          {!pending && <Sparkles aria-hidden className="size-4" />}
          {pending ? "Classifying and issuing invoice…" : "Generate customs data & invoice"}
        </Button>
      </form>
    </section>
  );
}
