"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { Alert } from "@/components/ui/alert";
import { safeNextPath } from "@/lib/utils/safe-redirect";

import { AuthLink } from "./auth-card";
import { CONFIRMATION_FAILED_MESSAGE } from "./auth-errors";

// The auth pages prerender as a static shell, so URL state is read on the
// client: at event time for actions, and behind Suspense for rendering.

export function readNextPath() {
  return safeNextPath(new URLSearchParams(window.location.search).get("next"));
}

function withNext(href: string, next: string) {
  return next === "/" ? href : `${href}?next=${encodeURIComponent(next)}`;
}

function SwitchLinkInner({ href, children }: { href: string; children: ReactNode }) {
  const next = safeNextPath(useSearchParams().get("next"));
  return <AuthLink href={withNext(href, next)}>{children}</AuthLink>;
}

// Link to the other auth page that keeps ?next= so the user still lands
// where they were headed.
export function SwitchLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Suspense fallback={<AuthLink href={href}>{children}</AuthLink>}>
      <SwitchLinkInner href={href}>{children}</SwitchLinkInner>
    </Suspense>
  );
}

function CallbackErrorInner() {
  const failed = useSearchParams().get("error") === "confirmation_failed";
  return failed ? <Alert>{CONFIRMATION_FAILED_MESSAGE}</Alert> : null;
}

// Shown when /auth/callback bounced back with ?error=confirmation_failed.
export function CallbackError() {
  return (
    <Suspense fallback={null}>
      <CallbackErrorInner />
    </Suspense>
  );
}
