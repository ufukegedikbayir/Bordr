// Invitation rules shared by the Server Actions and the UI. Kept out of the
// "use server" module, which may only export async functions.
import { z } from "zod";

export const INVITE_ROLES = [
  { role: "member", name: "Member", description: "Creates shipments and downloads documents." },
  { role: "owner", name: "Owner", description: "Also manages the company profile, logo and team." },
] as const;

export type InviteRole = (typeof INVITE_ROLES)[number]["role"];

/** Days an invitation link stays valid. The database default agrees. */
export const INVITE_VALID_DAYS = 7;

/** The token in an invitation link: 32 random bytes, base64url. */
export const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function invitePath(token: string) {
  return `/invites/${token}`;
}

// Mirrors the database check; the database also lower-cases and trims.
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const inviteSchema = z.object({
  email: z
    .string()
    .transform((v) => v.trim().toLowerCase())
    .pipe(
      z
        .string()
        .min(1, "Enter an email address.")
        .max(254, "That address is too long.")
        .regex(EMAIL, "Enter a valid email address, e.g. name@company.com."),
    ),
  role: z.enum(["member", "owner"], { error: "Choose a role." }),
});
