"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { Check, Copy, UserPlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { cn } from "@/lib/utils/cn";
import { INVITE_ROLES, INVITE_VALID_DAYS, type InviteRole } from "@/services/workspaces/invitation-rules";
import { inviteUser, type InviteResult } from "@/services/workspaces/invitations";

type Created = Extract<InviteResult, { ok: true }> & { url: string };

/**
 * Owner-only: the page renders it for owners, and inviteUser and the database
 * refuse everyone else. A native modal dialog, so focus is trapped and Escape
 * closes it without extra code.
 */
export function InviteDialog({ workspaceName }: { workspaceName: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("member");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; field?: "email" | "role" } | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState(false);

  function open() {
    setEmail("");
    setRole("member");
    setError(null);
    setCreated(null);
    setCopied(false);
    dialogRef.current?.showModal();
    emailRef.current?.focus();
  }

  function close() {
    dialogRef.current?.close();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await inviteUser(email, role);
      if (result.ok) {
        setCreated({ ...result, url: new URL(result.path, window.location.origin).toString() });
      } else {
        setError({ message: result.error, field: result.field });
        if (result.field !== "role") emailRef.current?.focus();
      }
    } catch {
      setError({ message: "Couldn't create the invitation. Try again." });
    } finally {
      setPending(false);
    }
  }

  async function copy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const emailError = error && error.field !== "role" ? error.message : null;
  const roleError = error?.field === "role" ? error.message : null;

  return (
    <>
      <Button type="button" onClick={open} className="h-9">
        <UserPlus aria-hidden className="size-4" />
        Invite member
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`${id}-title`}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-hairline bg-surface p-0 text-ink shadow-card backdrop:bg-ink/40"
      >
        <div className="flex items-start justify-between gap-4 border-b border-hairline px-6 py-4">
          <div>
            <h2 id={`${id}-title`} className="text-sm font-semibold tracking-tight">
              {created ? "Invitation created" : "Invite to the workspace"}
            </h2>
            <p className="mt-0.5 text-[13px] text-ink-muted">{workspaceName}</p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="inline-grid size-8 place-items-center rounded-md text-ink-muted outline-none hover:bg-ground hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>

        {created ? (
          <div className="grid gap-4 px-6 py-5">
            <p className="text-sm">
              Send this link to <span className="font-medium">{created.email}</span>. They join as{" "}
              {created.role === "owner" ? "an owner" : "a member"} after signing in with that address.
            </p>
            <div className="flex gap-2">
              <input
                readOnly
                value={created.url}
                aria-label="Invitation link"
                onFocus={(event) => event.currentTarget.select()}
                className={cn(controlClass, "h-10 font-mono text-[13px]")}
              />
              <Button type="button" variant="secondary" onClick={copy} className="shrink-0">
                {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-[13px] text-ink-muted">
              The link works once and expires in {INVITE_VALID_DAYS} days. Copy it now: Bordr keeps only a fingerprint of it,
              so it can&apos;t be shown again. Email delivery comes later.
            </p>
            <div className="flex justify-end">
              <Button type="button" onClick={close}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="grid gap-5 px-6 py-5">
            <div className="grid gap-1.5">
              <label htmlFor={`${id}-email`} className="text-sm font-medium">
                Email address
              </label>
              <input
                ref={emailRef}
                id={`${id}-email`}
                type="email"
                autoComplete="off"
                spellCheck={false}
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (emailError) setError(null);
                }}
                aria-invalid={emailError ? true : undefined}
                aria-describedby={emailError ? `${id}-email-error` : undefined}
                placeholder="name@company.com"
                className={cn(controlClass, "h-10")}
              />
              {emailError && (
                <p id={`${id}-email-error`} role="alert" className="text-[13px] font-medium text-danger">
                  {emailError}
                </p>
              )}
            </div>

            <fieldset className="grid gap-2">
              <legend className="mb-1.5 text-sm font-medium">Role</legend>
              {INVITE_ROLES.map((option) => (
                <label
                  key={option.role}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors duration-150",
                    "has-focus-visible:ring-2 has-focus-visible:ring-accent",
                    role === option.role ? "border-accent bg-accent-surface" : "border-hairline hover:border-hairline-strong",
                  )}
                >
                  <input
                    type="radio"
                    name="role"
                    value={option.role}
                    checked={role === option.role}
                    onChange={() => setRole(option.role)}
                    className="mt-0.5 accent-[var(--color-accent)]"
                  />
                  <span>
                    <span className="block text-sm font-medium">{option.name}</span>
                    <span className="block text-[13px] text-ink-muted">{option.description}</span>
                  </span>
                </label>
              ))}
              {roleError && (
                <p role="alert" className="text-[13px] font-medium text-danger">
                  {roleError}
                </p>
              )}
            </fieldset>

            {error && !error.field && (
              <p role="alert" className="text-[13px] font-medium text-danger">
                {error.message}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" loading={pending}>
                Create invitation
              </Button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
