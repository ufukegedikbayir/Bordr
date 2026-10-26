import type { FormEvent, Ref } from "react";
import { Sparkles, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { cn } from "@/lib/utils/cn";
import type { Carrier } from "@/services/carriers/queries";
import { DESTINATIONS, isIntraEu } from "@/services/customs/constants";
import { ADR_CLASSES, PACKING_GROUPS, TUNNEL_CODES, customsFormalities } from "@/services/customs/freight";
import { CURRENCIES, INCOTERMS, WORLD_COUNTRIES, type Incoterm } from "@/services/customs/invoice";
import {
  SHIPMENT_MASKS,
  type FieldErrors,
  type ScalarField,
  type ShipmentFormValues,
} from "@/services/customs/shipment-input";

import { FormField, Fieldset, Select, a11y, firstError, input, masked, numeric } from "./form-controls";
import { LinesEditor, type LinesEditorProps } from "./lines-editor";
import { PackagesEditor, type PackagesEditorProps } from "./packages-editor";

type ShipmentFormProps = {
  values: ShipmentFormValues;
  errors: FieldErrors;
  pending: boolean;
  /** The exporter's country, from the company profile. */
  exporterCountry: string | null;
  carriers: Carrier[];
  textareaRef: Ref<HTMLTextAreaElement>;
  onChange: (key: ScalarField, value: string) => void;
  onPickCarrier: (carrier: Carrier) => void;
  onSubmit: () => void;
  onBlurField: (path: string) => void;
  lines: Pick<LinesEditorProps, "onChange" | "onAdd" | "onRemove" | "onBlurField">;
  packages: Omit<PackagesEditorProps, "packages" | "lines" | "errors">;
};

function CountryOptions() {
  return (
    <>
      <option value="" disabled>
        Choose a country
      </option>
      {WORLD_COUNTRIES.map(({ code, name }) => (
        <option key={code} value={code}>
          {name}
        </option>
      ))}
    </>
  );
}

function Segmented({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div role="radiogroup" className="inline-grid auto-cols-fr grid-flow-col rounded-lg border border-hairline-strong bg-ground p-0.5">
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            "cursor-pointer rounded-md px-3 py-1.5 text-center text-[13px] font-medium transition-colors duration-150",
            "has-focus-visible:ring-2 has-focus-visible:ring-accent",
            value === option.value ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink",
          )}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

export function ShipmentForm({
  values,
  errors,
  pending,
  exporterCountry,
  carriers,
  textareaRef,
  onChange,
  onPickCarrier,
  onSubmit,
  onBlurField,
  lines,
  packages,
}: ShipmentFormProps) {
  const error = (key: ScalarField) => firstError(errors, key);
  const bind = (key: ScalarField, hint = false) => ({
    ...a11y(key, error(key), hint),
    value: values[key],
    onChange: (event: Parameters<typeof masked>[0]) => onChange(key, masked(event, SHIPMENT_MASKS[key])),
    onBlur: () => onBlurField(key),
  });
  const dangerous = values.dangerous === "yes";
  const incoterm = INCOTERMS.some(({ code }) => code === values.incoterm) ? (values.incoterm as Incoterm) : null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
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
          <Fieldset
            legend="Goods"
            description="One item per kind of goods, as each should appear on the invoice. Each item gets its own HS code."
            aside={
              <div className="flex items-center gap-2">
                <label htmlFor={a11y("currency", undefined).id} className="text-[13px] text-ink-muted">
                  Invoice currency
                </label>
                <Select {...bind("currency")} className="w-28">
                  {CURRENCIES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </Select>
              </div>
            }
          >
            <LinesEditor
              lines={values.lines}
              packages={values.packages}
              currency={values.currency}
              errors={errors}
              textareaRef={textareaRef}
              onSubmitShortcut={onSubmit}
              {...lines}
            />
          </Fieldset>

          <Fieldset
            legend="Dangerous goods"
            description="Goods regulated under ADR need their UN description on the CMR and packing list."
            aside={
              <Segmented
                name="dangerous"
                value={values.dangerous}
                onChange={(value) => onChange("dangerous", value)}
                options={[
                  { value: "no", label: "Not dangerous" },
                  { value: "yes", label: "ADR goods" },
                ]}
              />
            }
          >
            {dangerous && (
              <div className="grid gap-4 rounded-lg border border-hairline-strong bg-ground p-4">
                <p className="flex gap-2 text-[13px] text-ink-muted">
                  <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                  Take these from ADR Table A or the safety data sheet (section 14). The driver, carrier and every
                  tunnel on the route rely on them.
                </p>
                <div className="grid gap-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
                  <FormField path="unNumber" label="UN number" error={error("unNumber")}>
                    <div className="relative">
                      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-muted">UN</span>
                      <input {...bind("unNumber")} inputMode="numeric" maxLength={4} placeholder="1263" className={cn(numeric, "pl-10 font-mono")} />
                    </div>
                  </FormField>
                  <FormField path="shippingName" label="Proper shipping name" error={error("shippingName")}>
                    <input {...bind("shippingName")} maxLength={200} placeholder="e.g. PAINT" className={input} />
                  </FormField>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField path="hazardClass" label="Class" error={error("hazardClass")}>
                    <Select {...bind("hazardClass")}>
                      <option value="" disabled>
                        Choose
                      </option>
                      {ADR_CLASSES.map(({ code, name }) => (
                        <option key={code} value={code}>
                          {code} – {name}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField path="packingGroup" label="Packing group" error={error("packingGroup")}>
                    <Select {...bind("packingGroup")}>
                      <option value="">None assigned</option>
                      {PACKING_GROUPS.map((group) => (
                        <option key={group} value={group}>
                          {group}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField path="tunnelCode" label="Tunnel code" hint="None only if the route avoids restricted tunnels." error={error("tunnelCode")}>
                    <Select {...bind("tunnelCode")}>
                      <option value="">None</option>
                      {TUNNEL_CODES.map((code) => (
                        <option key={code} value={code}>
                          ({code})
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </div>
              </div>
            )}
          </Fieldset>

          <Fieldset legend="Packages" description="One entry per pallet or package, as labelled. Each carries one item's goods; the totals feed every document.">
            <PackagesEditor packages={values.packages} lines={values.lines} errors={errors} {...packages} />
          </Fieldset>

          <Fieldset legend="Delivery" description="Terms of delivery and where the goods go.">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField path="country" label="Destination country" error={error("country")}>
                <Select {...bind("country")}>
                  <option value="" disabled>
                    Choose a country
                  </option>
                  {DESTINATIONS.map(({ code, name }) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField path="incoterm" label="Incoterms® 2020" error={error("incoterm")}>
                <Select {...bind("incoterm")}>
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
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                path="incotermPlace"
                label="Named place"
                hint="The place the Incoterm refers to."
                error={error("incotermPlace")}
              >
                <input {...bind("incotermPlace", true)} maxLength={120} placeholder="e.g. Duisburg, Hafenstraße 9" className={input} />
              </FormField>
              <FormField
                path="deliveryPlace"
                label="Place of delivery"
                hint="Where the truck unloads (CMR box 3)."
                error={error("deliveryPlace")}
              >
                <input {...bind("deliveryPlace", true)} maxLength={200} className={input} />
              </FormField>
            </div>
          </Fieldset>

          <Fieldset legend="Consignee" description="Who receives the goods in the destination country.">
            <FormField path="consigneeName" label="Company name" error={error("consigneeName")}>
              <input {...bind("consigneeName")} maxLength={200} autoComplete="organization" className={input} />
            </FormField>
            <FormField
              path="consigneeAddress"
              label="Address"
              hint="Street, postal code and city. The country is the destination above."
              error={error("consigneeAddress")}
            >
              <textarea
                {...bind("consigneeAddress", true)}
                rows={3}
                maxLength={400}
                className={cn(controlClass, "resize-y py-2.5 leading-[1.375rem]")}
              />
            </FormField>
            <FormField
              path="consigneeTaxId"
              label="VAT / Tax ID or EORI"
              optional
              hint="Required by many destinations to clear the goods in the consignee's name."
              error={error("consigneeTaxId")}
            >
              <input {...bind("consigneeTaxId", true)} maxLength={30} spellCheck={false} className={cn(input, "font-mono")} />
            </FormField>
          </Fieldset>

          <Fieldset
            legend="Transport"
            description="The road carrier and vehicle, as they appear on the CMR consignment note."
            aside={
              carriers.length > 0 ? (
                <label className="grid gap-1 text-[13px]">
                  <span className="sr-only">Use a saved carrier</span>
                  <Select
                    value=""
                    onChange={(event) => {
                      const carrier = carriers.find(({ id }) => id === event.target.value);
                      if (carrier) onPickCarrier(carrier);
                    }}
                    className="h-9 w-56 text-[13px]"
                  >
                    <option value="">Use a saved carrier…</option>
                    {carriers.map(({ id, name }) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </Select>
                </label>
              ) : null
            }
          >
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <FormField path="carrierName" label="Carrier" error={error("carrierName")}>
                <input {...bind("carrierName")} maxLength={200} autoComplete="off" className={input} />
              </FormField>
              <FormField path="carrierCountry" label="Carrier's country" error={error("carrierCountry")}>
                <Select {...bind("carrierCountry")}>
                  <CountryOptions />
                </Select>
              </FormField>
            </div>
            <FormField path="carrierAddress" label="Carrier's address" error={error("carrierAddress")}>
              <textarea
                {...bind("carrierAddress")}
                rows={2}
                maxLength={400}
                className={cn(controlClass, "resize-y py-2.5 leading-[1.375rem]")}
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField path="vehicleRegistration" label="Truck registration" error={error("vehicleRegistration")}>
                <input {...bind("vehicleRegistration")} maxLength={15} spellCheck={false} autoComplete="off" placeholder="34 ABC 123" className={cn(input, "font-mono")} />
              </FormField>
              <FormField path="trailerRegistration" label="Trailer registration" optional error={error("trailerRegistration")}>
                <input {...bind("trailerRegistration")} maxLength={15} spellCheck={false} autoComplete="off" className={cn(input, "font-mono")} />
              </FormField>
            </div>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <FormField
                path="takingOverPlace"
                label="Place of loading"
                hint="Where the carrier takes over the goods (CMR box 4)."
                error={error("takingOverPlace")}
              >
                <input {...bind("takingOverPlace", true)} maxLength={200} className={input} />
              </FormField>
              <FormField path="takingOverDate" label="Loading date" error={error("takingOverDate")}>
                <input {...bind("takingOverDate")} type="date" className={numeric} />
              </FormField>
            </div>
            <FormField
              path="senderInstructions"
              label="Instructions for customs and the carrier"
              optional
              hint={incoterm ? `Left blank, the CMR prints: “${customsFormalities(incoterm, isIntraEu(exporterCountry, values.country))}”` : "Choose an Incoterm to see the default."}
              error={error("senderInstructions")}
            >
              <textarea
                {...bind("senderInstructions", true)}
                rows={2}
                maxLength={500}
                placeholder="e.g. T1 transit from Kapıkule. Keep upright."
                className={cn(controlClass, "resize-y py-2.5 leading-[1.375rem]")}
              />
            </FormField>
          </Fieldset>
        </fieldset>

        <Button type="submit" loading={pending} className="w-full">
          {!pending && <Sparkles aria-hidden className="size-4" />}
          {pending ? "Classifying and issuing documents…" : "Generate customs data & documents"}
        </Button>
      </form>
    </section>
  );
}
