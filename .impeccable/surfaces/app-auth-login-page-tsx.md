---
version: 1
slug: "app-auth-login-page-tsx"
primary_target: "app/(auth)/login/page.tsx"
related_targets: ["app/(auth)/signup/page.tsx"]
---

# Auth surface (login, signup, confirmation)

Scope: /login, /signup, signup "check your email" state, /auth/callback errors. Mode: Operate.
Audience/task: B2B customs operators signing in to do filing work; returning users sign in in seconds, new users create an account and confirm by email.
Constraints: WCAG 2.2 AA; no fabricated proof, badges, or claims; no marketing UI.
Pinned by owner: minimalist, strictly professional, central auth card, subtle borders, crisp typography, Vercel/Linear tier.

## Direction contract

THESIS: A sign-in that feels like passing a well-run border — one calm card, nothing to decode. Refuses the split-screen marketing auth page with a hero image and testimonial.

OWN-WORLD: Customs channel semantics as the palette: deep "green channel" (oklch 0.44 0.10 163) for primary action, focus, and cleared states; "red channel" (oklch 0.53 0.19 27) for errors only. Cool ink neutrals (ink oklch 0.21 0.02 255; ground oklch 0.985 0.003 255; hairline oklch 0.91 0.006 255). Geist, one family, 1.125-ish scale. 1px borders, 8px radii, one soft offset shadow.

STORY: The visitor recognizes Bordr, enters email and password, and is in. New visitors see exactly what happens next (check inbox) and can resend.

FIRST VIEWPORT: Top-left 20px logomark + wordmark. Card (max 400px) centered at ~40% height: 20px semibold title, 14px muted line, labelled fields, full-width green submit, toggle link under the card. Signature move: the logomark — two adjoining squares sharing one green edge (a border between territories); the same green edge returns as the 2px focus ring.

FORM: Pinned brief (canon, Vercel/Linear sit-alongside); no concept-seed run, owner pinned direction. Seed key: none (pinned).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
