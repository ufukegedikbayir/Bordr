import type { FormEvent, KeyboardEvent, Ref } from "react";
import { ChevronDown, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { cn } from "@/lib/utils/cn";
import {
  COUNTRIES,
  EXAMPLE_PRODUCTS,
  MAX_DESCRIPTION_LENGTH,
  type CountryCode,
} from "@/services/customs/constants";

type ShipmentFormProps = {
  description: string;
  country: CountryCode;
  pending: boolean;
  error: string | null;
  textareaRef: Ref<HTMLTextAreaElement>;
  onDescriptionChange: (value: string) => void;
  onCountryChange: (value: CountryCode) => void;
  onSubmit: () => void;
};

export function ShipmentForm({
  description,
  country,
  pending,
  error,
  textareaRef,
  onDescriptionChange,
  onCountryChange,
  onSubmit,
}: ShipmentFormProps) {
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
        <div className="grid gap-1.5">
          <label htmlFor="product-description" className="text-sm font-medium">
            Describe your product
          </label>
          <textarea
            ref={textareaRef}
            id="product-description"
            name="description"
            rows={5}
            maxLength={MAX_DESCRIPTION_LENGTH}
            value={description}
            readOnly={pending}
            onChange={(event) => onDescriptionChange(event.target.value)}
            onKeyDown={handleKeyDown}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "product-description-error" : "product-description-hint"}
            placeholder="e.g. Handmade leather wallet, 250g"
            className={cn(controlClass, "min-h-32 resize-y py-2.5 leading-[1.375rem]")}
          />
          <div className="flex items-start justify-between gap-4 text-[13px]">
            {error ? (
              <p id="product-description-error" role="alert" className="text-danger">
                {error}
              </p>
            ) : (
              <p id="product-description-hint" className="text-ink-muted">
                Include the material, weight and intended use.
              </p>
            )}
            <span className="shrink-0 tabular-nums text-ink-muted">
              {description.length}/{MAX_DESCRIPTION_LENGTH}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1.5">
            <span className="text-[13px] text-ink-muted">Try</span>
            {EXAMPLE_PRODUCTS.map((example) => (
              <button
                key={example}
                type="button"
                disabled={pending}
                onClick={() => onDescriptionChange(example)}
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
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="destination-country" className="text-sm font-medium">
            Destination country
          </label>
          <div className="relative">
            <select
              id="destination-country"
              name="country"
              value={country}
              disabled={pending}
              onChange={(event) => onCountryChange(event.target.value as CountryCode)}
              className={cn(controlClass, "h-10 cursor-pointer appearance-none pr-10")}
            >
              {COUNTRIES.map(({ code, name }) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden
              className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-muted"
            />
          </div>
        </div>

        <Button type="submit" loading={pending} className="w-full">
          {!pending && <Sparkles aria-hidden className="size-4" />}
          {pending ? "Analyzing…" : "Generate customs data"}
        </Button>
      </form>
    </section>
  );
}
