import type { AuthError } from "@supabase/supabase-js";

export const CONFIRMATION_FAILED_MESSAGE =
  "That confirmation link is invalid or has expired. Sign in, or sign up again to get a new link.";

export type AuthErrorInfo = {
  message: string;
  field?: "email" | "password";
  code?: string;
};

// Map Supabase error codes to copy that names the problem and the way out,
// plus the field it belongs to (if any).
export function describeAuthError(error: AuthError): AuthErrorInfo {
  const field = fieldFor(error.code);
  return { message: messageFor(error), field, code: error.code };
}

function fieldFor(code: string | undefined): AuthErrorInfo["field"] {
  switch (code) {
    case "invalid_credentials":
    case "weak_password":
      return "password";
    // email_not_confirmed has no field: the address is valid, just unconfirmed.
    case "user_already_exists":
    case "email_exists":
    case "email_address_invalid":
    case "email_address_not_authorized":
      return "email";
  }
  return undefined;
}

function messageFor(error: AuthError): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Email or password is incorrect.";
    case "email_not_confirmed":
      return "Confirm your email address first. Check your inbox for the link we sent.";
    case "user_already_exists":
    case "email_exists":
      return "An account with this email already exists. Sign in instead.";
    case "weak_password":
      return error.message || "Choose a stronger password.";
    case "email_address_invalid":
      return "Enter a valid email address.";
    case "email_address_not_authorized":
      return "Emails can't be sent to this address yet. Use an address on the project team, or configure custom SMTP in Supabase.";
    case "signup_disabled":
      return "New sign-ups are currently disabled.";
    case "over_email_send_rate_limit":
      return "Too many emails sent to this address. Wait a few minutes, then try again.";
    case "over_request_rate_limit":
      return "Too many attempts. Wait a moment, then try again.";
  }
  if (error.name === "AuthRetryableFetchError") {
    return "Can't reach the server. Check your connection and try again.";
  }
  return error.message || "Something went wrong. Try again.";
}
