"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { ArrowRight, Check, ChevronDown, CircleCheck, Lock } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { cn } from "@/lib/utils/cn";
import { WORLD_COUNTRIES } from "@/services/customs/invoice";
import { updateWorkspaceProfile, type ProfileActionState } from "@/services/workspaces/actions";
import { PROFILE_REQUIREMENTS, type CompanyProfile } from "@/services/workspaces/profile";

type Key = keyof CompanyProfile;

function Item({
  name,
  label,
  optional,
  hint,
  error,
  className,
  children,
}: {
  name: Key;
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
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
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<ProfileActionState>({ status: "idle" });
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  // Leaving with unsaved edits asks first, as any settings page should.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const errors = state.status === "invalid" ? state.fieldErrors : {};
  const error = (key: Key) => errors[key]?.[0];
  const input = cn(controlClass, "h-10", !canEdit && "disabled:cursor-default disabled:bg-ground disabled:opacity-100");
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
    if (pending || !dirty) return;
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateWorkspaceProfile(workspaceId, formData);
      setState(result);
      if (result.status === "saved") setDirty(false);
      if (result.status === "invalid") {
        const first = Object.keys(result.fieldErrors)[0];
        if (first) document.getElementById(`profile-${first}`)?.focus();
      }
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "s" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  function discard() {
    formRef.current?.reset();
    setDirty(false);
    setState({ status: "idle" });
  }

  function markDirty() {
    setDirty(true);
    if (state.status === "saved") setState({ status: "idle" });
  }

  const complete = PROFILE_REQUIREMENTS.every(({ met }) => met(profile));

  let footerNote: ReactNode;
  if (!canEdit) {
    footerNote = (
      <>
        <Lock aria-hidden className="size-3.5 shrink-0" />
        Only workspace owners can edit the legal profile.
      </>
    );
  } else if (state.status === "saved" && !pending) {
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
  } else if (dirty) {
    footerNote = "You have unsaved changes.";
  } else {
    footerNote = "Issued invoices keep the details they were issued with.";
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      onChange={canEdit ? markDirty : undefined}
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
          <Item name="legalName" label="Registered company name" error={error("legalName")}>
            <input {...field("legalName")} autoComplete="organization" className={input} />
          </Item>
          <Item name="addressLine1" label="Street address" error={error("addressLine1")}>
            <input {...field("addressLine1")} autoComplete="address-line1" className={input} />
          </Item>
          <Item name="addressLine2" label="Address line 2" optional error={error("addressLine2")}>
            <input {...field("addressLine2")} autoComplete="address-line2" className={input} />
          </Item>
          <div className="grid gap-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
            <Item name="postalCode" label="Postal code" error={error("postalCode")}>
              <input {...field("postalCode")} autoComplete="postal-code" className={input} />
            </Item>
            <Item name="city" label="City" error={error("city")}>
              <input {...field("city")} autoComplete="address-level2" className={input} />
            </Item>
          </div>
          <Item name="countryCode" label="Country" error={error("countryCode")}>
            <div className="relative">
              <select
                {...field("countryCode")}
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
          <div className="grid gap-4 sm:grid-cols-2">
            <Item
              name="eoriNumber"
              label="EORI number"
              hint="Needed to export from the EU or UK, e.g. DE123456789012345."
              error={error("eoriNumber")}
            >
              <input {...field("eoriNumber", true)} spellCheck={false} className={cn(input, "font-mono uppercase")} />
            </Item>
            <Item name="taxId" label="VAT / Tax ID" hint="e.g. DE123456789, or a national tax number." error={error("taxId")}>
              <input {...field("taxId", true)} spellCheck={false} className={cn(input, "font-mono uppercase")} />
            </Item>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Item
              name="signatoryName"
              label="Authorised signatory"
              hint="Signs the declaration on each invoice."
              error={error("signatoryName")}
            >
              <input {...field("signatoryName", true)} autoComplete="name" className={input} />
            </Item>
            <Item name="signatoryTitle" label="Signatory title" optional error={error("signatoryTitle")}>
              <input
                {...field("signatoryTitle")}
                autoComplete="organization-title"
                placeholder={canEdit ? "e.g. Export Manager" : undefined}
                className={input}
              />
            </Item>
          </div>
        </Group>
      </fieldset>

      {state.status === "error" && (
        <div className="px-6 pb-5">
          <Alert>
            <p>{state.error}</p>
          </Alert>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-b-xl border-t border-hairline bg-ground px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p role="status" className="flex items-center gap-1.5 text-[13px] text-ink-muted">
          {footerNote}
        </p>
        {canEdit && (
          <div className="flex shrink-0 gap-2">
            {dirty && !pending && (
              <Button type="button" variant="secondary" onClick={discard} className="h-9">
                Discard
              </Button>
            )}
            <Button type="submit" loading={pending} disabled={!dirty && !pending} className="h-9">
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        )}
      </div>
    </form>
  );
}
