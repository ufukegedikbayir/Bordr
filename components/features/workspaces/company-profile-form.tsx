"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { ArrowRight, Check, ChevronDown, CircleAlert, CircleCheck, Info, Lock } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { cn } from "@/lib/utils/cn";
import { WORLD_COUNTRIES } from "@/services/customs/invoice";
import { updateWorkspaceProfile } from "@/services/workspaces/actions";
import {
  PROFILE_FIELDS,
  PROFILE_MASKS,
  PROFILE_REQUIREMENTS,
  profileToValues,
  tidy,
  validateProfile,
  type CompanyProfile,
  type ProfileFieldErrors,
  type ProfileFormValues,
} from "@/services/workspaces/profile";

type Key = keyof CompanyProfile;

const MAX_LENGTH: Record<Key, number> = {
  legalName: 200,
  addressLine1: 200,
  addressLine2: 200,
  postalCode: 10,
  city: 100,
  countryCode: 2,
  eoriNumber: 17,
  taxId: 30,
  signatoryName: 120,
  signatoryTitle: 120,
};

const EORI_CHECK_URL = "https://ec.europa.eu/taxation_customs/dds2/eos/eori_validation.jsp?Lang=en";
const VIES_URL = "https://ec.europa.eu/taxation_customs/vies/";

const errorId = (key: Key) => `profile-${key}-error`;
const hintId = (key: Key) => `profile-${key}-hint`;

function Item({
  name,
  label,
  optional,
  hint,
  error,
  validNote,
  className,
  children,
}: {
  name: Key;
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  /** Shown in place of the hint once the value is well-formed. */
  validNote?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      <label htmlFor={`profile-${name}`} className="text-sm font-medium">
        {label}
        {optional && <span className="font-normal text-ink-muted"> (optional)</span>}
      </label>
      {children}
      {error ? (
        <p id={errorId(name)} className="flex gap-1.5 text-[13px] leading-5 font-medium text-danger">
          <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </p>
      ) : validNote ? (
        <p id={hintId(name)} className="flex items-center gap-1.5 text-[13px] text-accent">
          <Check aria-hidden className="size-3.5 shrink-0" />
          {validNote}
        </p>
      ) : hint ? (
        <p id={hintId(name)} className="text-[13px] text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Group({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="grid gap-x-10 gap-y-5 border-t border-hairline px-6 py-6 md:grid-cols-[13rem_minmax(0,1fr)]">
      <div>
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        <p className="mt-1 text-[13px] leading-5 text-ink-muted">{description}</p>
      </div>
      <div className="grid gap-4">{children}</div>
    </div>
  );
}

/** States what's still missing before this workspace can issue invoices. */
function Readiness({ profile }: { profile: CompanyProfile }) {
  const missing = PROFILE_REQUIREMENTS.filter(({ met }) => !met(profile)).length;

  if (missing === 0) {
    return (
      <span className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-accent-surface px-2.5 text-xs font-medium text-accent">
        <CircleCheck aria-hidden className="size-3.5" />
        Ready to issue invoices
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border border-hairline-strong px-2.5 text-xs font-medium text-ink-muted">
      <span aria-hidden className="size-1.5 rounded-full bg-ink-muted" />
      {missing} required {missing === 1 ? "item" : "items"} missing
    </span>
  );
}

function IdentityNotice() {
  const link = "font-medium text-ink underline decoration-hairline-strong underline-offset-2 hover:decoration-ink";
  return (
    <div className="flex gap-2.5 rounded-lg border border-hairline-strong bg-ground px-3 py-2.5 text-[13px] leading-5">
      <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-muted" />
      <p className="text-ink-muted">
        <span className="text-ink">Ensure your EORI number is valid and active.</span> Invalid IDs will cause
        customs clearance failures at the border. Bordr checks the format only; confirm registration with the{" "}
        <a href={EORI_CHECK_URL} target="_blank" rel="noopener noreferrer" className={link}>
          EU EORI check
        </a>{" "}
        or{" "}
        <a href={VIES_URL} target="_blank" rel="noopener noreferrer" className={link}>
          VIES for VAT
        </a>
        .
      </p>
    </div>
  );
}

export function CompanyProfileForm({
  workspaceId,
  workspaceName,
  profile,
  canEdit,
}: {
  workspaceId: string;
  workspaceName: string;
  profile: CompanyProfile;
  canEdit: boolean;
}) {
  const [saved, setSaved] = useState<ProfileFormValues>(() => profileToValues(profile));
  const [values, setValues] = useState<ProfileFormValues>(saved);
  const [touched, setTouched] = useState<Partial<Record<Key, boolean>>>({});
  const [revealAll, setRevealAll] = useState(false);
  const [serverErrors, setServerErrors] = useState<ProfileFieldErrors>({});
  const [status, setStatus] = useState<{ kind: "idle" | "saved" } | { kind: "error"; message: string }>({
    kind: "idle",
  });
  const [pending, startTransition] = useTransition();

  const errors = useMemo(() => validateProfile(values), [values]);
  const errorKeys = PROFILE_FIELDS.filter((key) => errors[key]);
  const dirty = PROFILE_FIELDS.some((key) => values[key] !== saved[key]);
  const canSave = canEdit && dirty && errorKeys.length === 0 && !pending;

  // Leaving with unsaved edits asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  /**
   * Errors appear once a field is left, or while typing as soon as what's
   * typed can't be right. A field the user hasn't reached stays quiet.
   */
  function visibleError(key: Key): string | undefined {
    if (serverErrors[key]) return serverErrors[key];
    const message = errors[key];
    if (!message) return undefined;
    const identityPair = key === "eoriNumber" && (touched.eoriNumber || touched.taxId);
    const typedSomething = values[key] !== "" && values[key] !== saved[key];
    return revealAll || touched[key] || identityPair || typedSomething ? message : undefined;
  }

  function control(key: Key, { hint = false, valid = false } = {}) {
    const error = visibleError(key);
    return {
      id: `profile-${key}`,
      name: key,
      value: values[key],
      maxLength: MAX_LENGTH[key],
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => change(key, event),
      onBlur: () => setTouched((current) => (current[key] ? current : { ...current, [key]: true })),
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? errorId(key) : hint || valid ? hintId(key) : undefined,
    };
  }

  function change(key: Key, event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const element = event.currentTarget;
    const raw = element.value;
    const mask = PROFILE_MASKS[key] ?? tidy;
    const next = element instanceof HTMLSelectElement ? raw : mask(raw);

    // Write the masked value straight back with the caret where the user left
    // it; otherwise React's re-render would throw the caret to the end.
    if (next !== raw && element instanceof HTMLInputElement) {
      const caret = mask(raw.slice(0, element.selectionStart ?? raw.length)).length;
      element.value = next;
      element.setSelectionRange(caret, caret);
    }

    setValues((current) => ({ ...current, [key]: next }));
    if (serverErrors[key]) {
      setServerErrors((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
    if (status.kind !== "idle") setStatus({ kind: "idle" });
  }

  function revealErrors() {
    setRevealAll(true);
    const first = errorKeys[0];
    if (first) document.getElementById(`profile-${first}`)?.focus();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || pending || !dirty) return;
    if (errorKeys.length) return revealErrors();

    const formData = new FormData();
    for (const key of PROFILE_FIELDS) formData.set(key, values[key]);

    startTransition(async () => {
      const result = await updateWorkspaceProfile(workspaceId, formData);
      if (result.status === "saved") {
        const stored = profileToValues(result.profile);
        setSaved(stored);
        setValues(stored);
        setTouched({});
        setRevealAll(false);
        setStatus({ kind: "saved" });
      } else if (result.status === "invalid") {
        const next = Object.fromEntries(
          Object.entries(result.fieldErrors).map(([key, messages]) => [key, messages?.[0]]),
        ) as ProfileFieldErrors;
        setServerErrors(next);
        const first = PROFILE_FIELDS.find((key) => next[key]);
        if (first) document.getElementById(`profile-${first}`)?.focus();
      } else if (result.status === "error") {
        setStatus({ kind: "error", message: result.error });
      }
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "s" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.currentTarget.requestSubmit();
    }
  }

  function discard() {
    setValues(saved);
    setTouched({});
    setRevealAll(false);
    setServerErrors({});
    setStatus({ kind: "idle" });
  }

  const complete = PROFILE_REQUIREMENTS.every(({ met }) => met(profile));
  const input = cn(controlClass, "h-10", !canEdit && "disabled:cursor-default disabled:bg-ground disabled:opacity-100");
  const mono = cn(input, "font-mono tracking-wide");
  const formatValid = (key: "eoriNumber" | "taxId") =>
    canEdit && values[key] !== "" && !errors[key] && !serverErrors[key] ? "Valid format" : undefined;

  let footerNote: ReactNode;
  if (!canEdit) {
    footerNote = (
      <>
        <Lock aria-hidden className="size-3.5 shrink-0" />
        Only workspace owners can edit the legal profile.
      </>
    );
  } else if (status.kind === "saved") {
    footerNote = (
      <>
        <Check aria-hidden className="size-4 shrink-0 text-accent" />
        <span>
          Saved. New invoices use these details.
          {complete && (
            <>
              {" "}
              <Link
                href="/shipments/new"
                className="inline-flex items-center gap-0.5 font-medium text-accent underline-offset-2 hover:underline"
              >
                Create a shipment
                <ArrowRight aria-hidden className="size-3.5" />
              </Link>
            </>
          )}
        </span>
      </>
    );
  } else if (dirty && errorKeys.length) {
    footerNote = (
      <button
        type="button"
        onClick={revealErrors}
        className="inline-flex items-center gap-1.5 font-medium text-danger underline-offset-2 hover:underline"
      >
        <CircleAlert aria-hidden className="size-3.5 shrink-0" />
        Fix {errorKeys.length} {errorKeys.length === 1 ? "field" : "fields"} to save
      </button>
    );
  } else if (dirty) {
    footerNote = "All fields are valid. You have unsaved changes.";
  } else {
    footerNote = "Issued invoices keep the details they were issued with.";
  }

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={canEdit ? handleKeyDown : undefined}
      noValidate
      aria-labelledby="legal-profile-heading"
      className="rounded-xl border border-hairline bg-surface shadow-card"
    >
      <div className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="legal-profile-heading" className="text-base font-semibold tracking-tight">
            Legal profile
          </h2>
          <p className="mt-1 max-w-xl text-[13px] leading-5 text-ink-muted">
            The exporter on every invoice issued in <span className="font-medium text-ink">{workspaceName}</span>.
            Customs check these against official registers, so enter them exactly as registered.
          </p>
        </div>
        <Readiness profile={profile} />
      </div>

      <fieldset disabled={pending || !canEdit} className="contents">
        <Group title="Company details" description="Your registered name and address, as on your trade register entry.">
          <Item name="legalName" label="Registered company name" error={visibleError("legalName")}>
            <input {...control("legalName")} autoComplete="organization" className={input} />
          </Item>
          <Item name="addressLine1" label="Street address" error={visibleError("addressLine1")}>
            <input {...control("addressLine1")} autoComplete="address-line1" className={input} />
          </Item>
          <Item name="addressLine2" label="Address line 2" optional error={visibleError("addressLine2")}>
            <input {...control("addressLine2")} autoComplete="address-line2" className={input} />
          </Item>
          <div className="grid gap-4 sm:grid-cols-[9rem_minmax(0,1fr)]">
            <Item name="postalCode" label="Postal code" error={visibleError("postalCode")}>
              <input
                {...control("postalCode")}
                autoComplete="postal-code"
                autoCapitalize="characters"
                spellCheck={false}
                className={input}
              />
            </Item>
            <Item name="city" label="City" error={visibleError("city")}>
              <input {...control("city")} autoComplete="address-level2" className={input} />
            </Item>
          </div>
          <Item name="countryCode" label="Country" error={visibleError("countryCode")}>
            <div className="relative">
              <select
                {...control("countryCode")}
                autoComplete="country"
                className={cn(input, "cursor-pointer appearance-none pr-10")}
              >
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
        </Group>

        <Group
          title="Customs & tax identity"
          description="How customs identify you, and who signs the invoice declaration. EORI, VAT ID, or both."
        >
          <IdentityNotice />
          <div className="grid gap-4 sm:grid-cols-2">
            <Item
              name="eoriNumber"
              label="EORI number"
              hint="Country code, then up to 15 characters, e.g. DE123456789012345."
              error={visibleError("eoriNumber")}
              validNote={formatValid("eoriNumber")}
            >
              <input
                {...control("eoriNumber", { hint: true, valid: true })}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                placeholder={canEdit ? "DE123456789012345" : undefined}
                className={mono}
              />
            </Item>
            <Item
              name="taxId"
              label="VAT / Tax ID"
              hint="e.g. DE123456789, or a national tax number."
              error={visibleError("taxId")}
              validNote={formatValid("taxId")}
            >
              <input
                {...control("taxId", { hint: true, valid: true })}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                className={mono}
              />
            </Item>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Item
              name="signatoryName"
              label="Authorised signatory"
              hint="Signs the declaration on each invoice."
              error={visibleError("signatoryName")}
            >
              <input {...control("signatoryName", { hint: true })} autoComplete="name" className={input} />
            </Item>
            <Item name="signatoryTitle" label="Signatory title" optional error={visibleError("signatoryTitle")}>
              <input
                {...control("signatoryTitle")}
                autoComplete="organization-title"
                placeholder={canEdit ? "e.g. Export Manager" : undefined}
                className={input}
              />
            </Item>
          </div>
        </Group>
      </fieldset>

      {status.kind === "error" && (
        <div className="px-6 pb-5">
          <Alert>
            <p>{status.message}</p>
          </Alert>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-b-xl border-t border-hairline bg-ground px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="status" className="flex items-center gap-1.5 text-[13px] text-ink-muted">
          {footerNote}
        </div>
        {canEdit && (
          <div className="flex shrink-0 gap-2">
            {dirty && !pending && (
              <Button type="button" variant="secondary" onClick={discard} className="h-9">
                Discard
              </Button>
            )}
            <Button
              type="submit"
              loading={pending}
              disabled={!canSave && !pending}
              title={dirty && errorKeys.length ? "Fix the highlighted fields to save" : undefined}
              // Fully greyed out, not a faded green, so it never reads as clickable.
              className="h-9 disabled:bg-hairline-strong disabled:text-ink-muted disabled:opacity-100 disabled:shadow-none"
            >
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        )}
      </div>
    </form>
  );
}
