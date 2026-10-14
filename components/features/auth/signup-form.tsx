"use client";

import { Check, MailCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, PasswordField } from "@/components/ui/field";
import { createBrowserClient } from "@/lib/supabase/client";

import { AuthCard } from "./auth-card";
import { describeAuthError, type AuthErrorInfo } from "./auth-errors";
import { readNextPath, SwitchLink } from "./url-state";

const MIN_PASSWORD_LENGTH = 8;
const RESEND_COOLDOWN_MS = 30_000;

function callbackUrl() {
  const url = new URL("/auth/callback", window.location.origin);
  const next = readNextPath();
  if (next !== "/") url.searchParams.set("next", next);
  return url.toString();
}

export function SignupForm() {
  const router = useRouter();
  const errorId = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<AuthErrorInfo | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    setError(null);
    setPending(true);

    const supabase = createBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: callbackUrl() },
    });

    if (error) {
      const info = describeAuthError(error);
      setError(info);
      setPending(false);
      const target = info.field === "password" ? passwordRef.current : emailRef.current;
      target?.focus();
      target?.select();
      return;
    }

    // Email confirmation disabled in Supabase: we already have a session.
    if (data.session) {
      router.replace(readNextPath());
      router.refresh();
      return;
    }

    setSentTo(email);
    setPending(false);
  }

  if (sentTo) {
    return (
<CheckEmail email={sentTo} onChangeEmail={() => setSentTo(null)} />
    );
  }

  return (
    <AuthCard
      title="Create your Bordr account"
      description="Use your work email. We'll send a link to confirm it."
      footer={
        <>
          Already have an account? <SwitchLink href="/login">Sign in</SwitchLink>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="grid gap-4">
        {error && <Alert id={errorId}>{error.message}</Alert>}
        <Field
          ref={emailRef}
          label="Work email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="name@company.com"
          required
          autoFocus
          readOnly={pending}
          errorId={error && error.field !== "password" ? errorId : undefined}
        />
        <PasswordField
          ref={passwordRef}
          label="Password"
          name="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
          readOnly={pending}
          errorId={error?.field === "password" ? errorId : undefined}
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        />
        <Button type="submit" loading={pending} className="mt-2 w-full">
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthCard>
  );
}

type CheckEmailProps = {
  email: string;
  onChangeEmail: () => void;
};

function CheckEmail({ email, onChangeEmail }: CheckEmailProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [resend, setResend] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  // Move focus to the new heading so screen readers announce the state change.
  useEffect(() => titleRef.current?.focus(), []);

  useEffect(() => {
    if (resend !== "sent") return;
    const timer = setTimeout(() => setResend("idle"), RESEND_COOLDOWN_MS);
    return () => clearTimeout(timer);
  }, [resend]);

  async function handleResend() {
    setError(null);
    setResend("sending");
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: callbackUrl() },
    });
    if (error) {
      setError(describeAuthError(error).message);
      setResend("idle");
      return;
    }
    setResend("sent");
  }

  return (
    <AuthCard
      titleRef={titleRef}
      title="Check your email"
      description={
        <>
          We sent a confirmation link to{" "}
          <span title={email} className="inline-block max-w-full truncate align-bottom font-medium text-ink">
            {email}
          </span>
          . Open it on this device to activate your account.
        </>
      }
      footer={
        <>
          Already confirmed? <SwitchLink href="/login">Sign in</SwitchLink>
        </>
      }
    >
      <div className="grid gap-4 motion-safe:animate-[auth-enter_200ms_ease-out]">
        <div className="flex items-start gap-3 rounded-lg bg-accent-surface px-3 py-3 text-sm leading-5 text-ink">
          <MailCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
          <p>Can&apos;t find it? Check spam, or resend the link. It can take a minute to arrive.</p>
        </div>
        {error && <Alert>{error}</Alert>}
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleResend}
            loading={resend === "sending"}
            disabled={resend === "sent"}
          >
            {resend === "sent" ? (
              <>
                <Check aria-hidden className="size-4 text-accent" />
                Link sent
              </>
            ) : (
              "Resend link"
            )}
          </Button>
          <Button type="button" variant="secondary" onClick={onChangeEmail}>
            Use another email
          </Button>
        </div>
        <p aria-live="polite" className="sr-only">
          {resend === "sent" ? `A new confirmation link was sent to ${email}.` : ""}
        </p>
      </div>
    </AuthCard>
  );
}
