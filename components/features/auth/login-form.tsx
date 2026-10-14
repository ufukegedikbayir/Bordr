"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, PasswordField } from "@/components/ui/field";
import { createBrowserClient } from "@/lib/supabase/client";

import { AuthCard } from "./auth-card";
import { describeAuthError, type AuthErrorInfo } from "./auth-errors";
import { CallbackError, readNextPath, SwitchLink } from "./url-state";

export function LoginForm() {
  const router = useRouter();
  const errorId = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<AuthErrorInfo | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [resend, setResend] = useState<"idle" | "sending" | "sent">("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    setError(null);
    setResend("idle");
    setSubmitted(true);
    setPending(true);

    const supabase = createBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const info = describeAuthError(error);
      setError(info);
      setPending(false);
      // Return focus to the field that needs fixing.
      const target = info.field === "email" ? emailRef.current : passwordRef.current;
      target?.focus();
      target?.select();
      return;
    }

    // Keep the button busy through navigation; refresh so server components
    // re-render with the new session cookie.
    router.replace(readNextPath());
    router.refresh();
  }

  async function handleResend() {
    const email = emailRef.current?.value.trim();
    if (!email) return;
    setResend("sending");
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: new URL("/auth/callback", window.location.origin).toString() },
    });
    if (error) {
      setError(describeAuthError(error));
      setResend("idle");
      return;
    }
    setResend("sent");
  }

  const fieldError = (field: AuthErrorInfo["field"]) =>
    error?.field === field ? errorId : undefined;

  return (
    <AuthCard
      title="Sign in to Bordr"
      description="Enter your work email and password."
      footer={
        <>
          New to Bordr? <SwitchLink href="/signup">Create an account</SwitchLink>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="grid gap-4">
        {error ? (
          <Alert id={errorId}>
            {error.message}
            {error.code === "email_not_confirmed" && (
              <button
                type="button"
                onClick={handleResend}
                disabled={resend !== "idle"}
                className="mt-1 block rounded-sm font-medium underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-danger disabled:no-underline disabled:opacity-80"
              >
                {resend === "sent"
                  ? "Confirmation link sent."
                  : resend === "sending"
                    ? "Sending…"
                    : "Resend confirmation link"}
              </button>
            )}
          </Alert>
        ) : (
          !submitted && <CallbackError />
        )}
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
          errorId={fieldError("email")}
        />
        <PasswordField
          ref={passwordRef}
          label="Password"
          name="password"
          autoComplete="current-password"
          required
          readOnly={pending}
          errorId={fieldError("password")}
        />
        <Button type="submit" loading={pending} className="mt-2 w-full">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthCard>
  );
}
