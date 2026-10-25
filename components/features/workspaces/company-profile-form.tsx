"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { cn } from "@/lib/utils/cn";
import { WORLD_COUNTRIES, regionName } from "@/services/customs/invoice";
import { updateCompanyProfile, type ProfileActionState } from "@/services/workspaces/actions";
import type { CompanyProfile } from "@/services/workspaces/profile";

type Key = keyof CompanyProfile;

const input = cn(controlClass, "h-10");

function Item({
  name,
  label,
  hint,
  error,
  className,
  children,
}: {
  name: Key;
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      <label htmlFor={`profile-${name}`} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`profile-${name}-error`} className="text-[13px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`profile-${name}-hint`} className="text-[13px] text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Read-only view for members: they act under the profile but can't change it. */
function ProfileSummary({ profile }: { profile: CompanyProfile }) {
  const rows: Array<[string, string | null]> = [
    ["Registered name", profile.legalName],
    [
      "Address",
      [profile.addressLine1, profile.addressLine2, [profile.postalCode, profile.city].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(", ") || null,
    ],
    ["Country", profile.countryCode ? regionName(profile.countryCode) : null],
    ["EORI", profile.eoriNumber],
    ["VAT / Tax ID", profile.taxId],
    ["Signatory", [profile.signatoryName, profile.signatoryTitle].filter(Boolean).join(", ") || null],
  ];

  return (
    <div className="grid gap-4">
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-ink-muted">{label}</dt>
            <dd className={cn("min-w-0", !value && "text-ink-muted")}>{value ?? "Not set"}</dd>
          </div>
        ))}
      </dl>
      <p className="text-[13px] text-ink-muted">Only workspace owners can change the company profile.</p>
    </div>
  );
}

export function CompanyProfileForm({
  workspaceId,
  profile,
  canEdit,
}: {
  workspaceId: string;
  profile: CompanyProfile;
  canEdit: boolean;
}) {
  const [state, setState] = useState<ProfileActionState>({ status: "idle" });
  const [pending, startTransition] = useTransition();

  if (!canEdit) return <ProfileSummary profile={profile} />;

  const errors = state.status === "invalid" ? state.fieldErrors : {};
  const error = (key: Key) => errors[key]?.[0];
  const field = (key: Key, hint = false) => ({
    id: `profile-${key}`,
    name: key,
    defaultValue: profile[key] ?? "",
    "aria-invalid": error(key) ? true : undefined,
    "aria-describedby": error(key) ? `profile-${key}-error` : hint ? `profile-${key}-hint` : undefined,
  });

  // Submitted by hand rather than through `action`: React resets uncontrolled
  // forms after an action, which would wipe the user's input on a validation error.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateCompanyProfile(state, formData);
      setState(result);
      if (result.status === "invalid") {
        const first = Object.keys(result.fieldErrors)[0];
        if (first) document.getElementById(`profile-${first}`)?.focus();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-5">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <fieldset disabled={pending} className="grid gap-5">
        <Item name="legalName" label="Registered company name" error={error("legalName")}>
          <input {...field("legalName")} autoComplete="organization" className={input} />
        </Item>

        <div className="grid gap-4 sm:grid-cols-2">
          <Item name="addressLine1" label="Street address" error={error("addressLine1")}>
            <input {...field("addressLine1")} autoComplete="address-line1" className={input} />
          </Item>
          <Item name="addressLine2" label="Address line 2 (optional)" error={error("addressLine2")}>
            <input {...field("addressLine2")} autoComplete="address-line2" className={input} />
          </Item>
        </div>

        <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)]">
          <Item name="postalCode" label="Postal code" error={error("postalCode")}>
            <input {...field("postalCode")} autoComplete="postal-code" className={input} />
          </Item>
          <Item name="city" label="City" error={error("city")}>
            <input {...field("city")} autoComplete="address-level2" className={input} />
          </Item>
          <Item name="countryCode" label="Country" error={error("countryCode")}>
            <div className="relative">
              <select {...field("countryCode")} className={cn(input, "cursor-pointer appearance-none pr-10")}>
                <option value="" disabled>
                  Choose a country
                </option>
                {WORLD_COUNTRIES.map(({ code, name }) => (
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
          </Item>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Item
            name="eoriNumber"
            label="EORI number"
            hint="Needed to export from the EU or UK, e.g. DE123456789012345."
            error={error("eoriNumber")}
          >
            <input {...field("eoriNumber", true)} className={cn(input, "uppercase")} />
          </Item>
          <Item name="taxId" label="VAT / Tax ID" hint="e.g. DE123456789 or a national tax number." error={error("taxId")}>
            <input {...field("taxId", true)} className={cn(input, "uppercase")} />
          </Item>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Item
            name="signatoryName"
            label="Authorised signatory"
            hint="The person who signs invoices for the company."
            error={error("signatoryName")}
          >
            <input {...field("signatoryName", true)} autoComplete="name" className={input} />
          </Item>
          <Item name="signatoryTitle" label="Signatory title (optional)" error={error("signatoryTitle")}>
            <input {...field("signatoryTitle")} autoComplete="organization-title" placeholder="e.g. Export Manager" className={input} />
          </Item>
        </div>
      </fieldset>

      {state.status === "error" && (
        <Alert>
          <p>{state.error}</p>
        </Alert>
      )}

      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
        {state.status === "saved" && !pending && (
          <p role="status" className="flex items-center gap-1.5 text-[13px] text-ink-muted">
            <Check aria-hidden className="size-4 text-accent" />
            Saved. New invoices use these details; issued invoices keep theirs.
          </p>
        )}
        <Button type="submit" loading={pending} className="sm:w-auto">
          Save company profile
        </Button>
      </div>
    </form>
  );
}
