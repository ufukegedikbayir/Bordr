---
name: Bordr
description: Calm, precise product UI for cross-border customs work.
colors:
  ground: "oklch(0.985 0.003 255)"
  surface: "oklch(1 0 0)"
  ink: "oklch(0.21 0.02 255)"
  ink-muted: "oklch(0.47 0.015 255)"
  hairline: "oklch(0.91 0.006 255)"
  hairline-strong: "oklch(0.84 0.008 255)"
  green-channel: "oklch(0.44 0.1 163)"
  green-channel-deep: "oklch(0.39 0.095 163)"
  green-channel-ink: "oklch(0.99 0.008 163)"
  green-channel-wash: "oklch(0.965 0.02 163)"
  red-channel: "oklch(0.5 0.18 27)"
  red-channel-wash: "oklch(0.97 0.014 27)"
  red-channel-border: "oklch(0.88 0.05 27)"
typography:
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.375rem
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.25rem
  hint:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
  wordmark:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    letterSpacing: "-0.02em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
spacing:
  field-gap: "6px"
  stack: "16px"
  card-pad-mobile: "24px"
  card-pad: "32px"
components:
  button-primary:
    backgroundColor: "{colors.green-channel}"
    textColor: "{colors.green-channel-ink}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 16px"
  button-primary-hover:
    backgroundColor: "{colors.green-channel-deep}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 16px"
  button-secondary-hover:
    backgroundColor: "{colors.ground}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 12px"
  alert-error:
    backgroundColor: "{colors.red-channel-wash}"
    textColor: "{colors.red-channel}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "32px"
---

# Design System: Bordr

## Overview

**Creative North Star: "The Green Channel"**

Bordr's interface should feel like walking through a well-run border: one calm lane, clear signage, nothing to decode. The palette borrows the semantics every traveller knows from customs halls. The green channel means proceed, so it carries primary actions, focus and cleared states. The red channel means stop and declare, so it is reserved for errors. Everything else is cool ink on a near-white ground.

This is product UI, not marketing. Density stays modest, there is one workhorse sans, and borders do the structural work while shadows stay faint. The owner's bar is "Vercel/Linear tier": restraint, exact alignment, every state designed.

**Key Characteristics:**
- Cool ink neutrals on a faintly blue-tinted ground; never warm cream.
- Green is meaning, not decoration: action, focus, success.
- Red appears only when something needs fixing.
- 1px hairlines and one soft card shadow; no glass, no gradients.
- Every interactive element ships default, hover, focus, loading, disabled and error states.

## Colors

Restrained palette: tinted neutrals plus two semantic channels that each do one job.

### Primary
- **Green Channel** (`green-channel`): Primary buttons, focus edges, text caret, selection tint, success and info washes. In dark mode it lightens to oklch(0.74 0.13 163) with dark ink text.
- **Green Channel Deep** (`green-channel-deep`): Hover state of primary buttons.
- **Green Channel Wash** (`green-channel-wash`): Background of neutral-positive notices, such as "check your inbox".

### Secondary
- **Red Channel** (`red-channel`): Error text, error icons, invalid field borders and focus edges.
- **Red Channel Wash / Border** (`red-channel-wash`, `red-channel-border`): Error alert container.

### Neutral
- **Ink** (`ink`): Headings, labels, input values, link text.
- **Muted Ink** (`ink-muted`): Descriptions, hints, placeholders, secondary footer text. Passes 4.5:1 on surface.
- **Ground** (`ground`): Page background.
- **Surface** (`surface`): Cards and inputs.
- **Hairline / Hairline Strong** (`hairline`, `hairline-strong`): Card border, and the stronger stroke on inputs and secondary buttons.

All tokens are redefined for `prefers-color-scheme: dark` in `app/globals.css`, which also sets `color-scheme`.

### Named Rules
**The Two Channels Rule.** Green means go and red means stop. Never use either as decoration, for brand flourishes or for charts that don't carry that meaning.

**The Cool Ink Rule.** Neutrals carry a slight blue tint (hue 255). Pure greys and warm creams are off-system.

## Typography

**Body Font:** Geist (via `next/font`, self-hosted), falling back to ui-sans-serif and system-ui.

**Character:** One neutral, engineered sans for everything. Hierarchy comes from weight and small size steps, not from a second family.

### Hierarchy
- **Title** (600, 20px, -0.015em): Card and page titles. Balanced wrapping.
- **Label** (500, 14px): Form labels and button text.
- **Body** (400, 14px, 22px line height): Descriptions and alert text. Pretty wrapping.
- **Hint** (400, 13px): Helper text under fields.
- **Wordmark** (600, 15px, -0.02em): The "Bordr" lockup next to the logomark.

Inputs render at 16px below the `sm` breakpoint so iOS Safari doesn't zoom on focus, and at 14px above it.

### Named Rules
**The One Family Rule.** Geist only. No display faces in UI, and monospace only for real code or data.

## Layout

Auth surfaces use a single centered column: a 400px-max card placed about 11vh from the top on desktop (6vh on mobile), with the logomark top-left at 20–32px insets. On narrow screens the card's horizontal gutter is 16px. Vertical rhythm inside the card is 16px between controls and 6px between a label and its input. Spacing above a heading group (24px to the form) is larger than the spacing within it.

## Elevation & Depth

Mostly flat. Structure comes from 1px borders, and one soft, offset shadow lifts the card off the ground. In dark mode, depth comes from a lighter surface instead of shadow.

### Shadow Vocabulary
- **Card** (`0 1px 2px oklch(0.21 0.02 255 / 0.04), 0 12px 32px -12px oklch(0.21 0.02 255 / 0.1)`): Primary containers only.
- **Button lift** (`0 1px 1px oklch(0.21 0.02 255 / 0.12)`): Primary buttons.
- **Input inset** (`inset 0 1px 1px oklch(0.21 0.02 255 / 0.03)`): Text inputs.

### Named Rules
**The One Lift Rule.** Only the outermost container gets the card shadow. Nested elements are bordered, never shadowed.

## Shapes

Gently rounded. Controls (inputs, buttons, alerts, notices) use 8px. The outer card uses 12px, chosen to be concentric with the 8px controls inside its padding rather than matching them; this is an intentional adaptation of the original 8px direction. Small inline targets such as the password toggle and text-link focus outlines use 6px.

### Logomark
Two territories with a border between them: a filled ink block on the left, an outlined block on the right, and a 1.75px green-channel line in the gap that extends past both. The line never touches the ink. It is 20px in the header lockup.

## Components

### Buttons
- **Shape:** 8px radius, 40px tall, 16px horizontal padding, 14px medium label.
- **Primary:** Green channel fill, near-white ink. Hover deepens to Green Channel Deep.
- **Secondary:** Surface fill, strong hairline border, ink text. Hover fills with ground.
- **Focus:** 2px green ring with a 2px surface offset (`focus-visible` only).
- **Loading:** A spinner before the label and a progressive label ("Signing in…"). Uses `aria-disabled` + `aria-busy`, never `disabled`, so keyboard focus is never dropped mid-submit.

### Inputs / Fields
- **Style:** Surface fill, 1px strong hairline, 8px radius, 40px tall, 12px padding.
- **Focus:** A solid 2px green edge (green border plus a 1px green ring), the same edge as button focus.
- **Error:** Red channel border and focus edge, plus `aria-invalid`, with `aria-describedby` pointing at the alert that explains it. Only the field at fault is marked.
- **Pending:** `readOnly`, so values stay legible.
- **Password:** Has an inline show/hide toggle (`aria-pressed`, labelled) inside the right edge.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** Surface.
- **Border:** 1px hairline.
- **Shadow Strategy:** Card shadow (see Elevation).
- **Internal Padding:** 32px, or 24px on mobile.

### Alerts
- **Error:** Red channel wash and border, red text, a 16px circle-alert icon, `role="alert"`. It sits inside the form above the fields and can hold one inline recovery action (for example "Resend confirmation link").
- **Notice:** Green channel wash, ink text, a green icon. Informational only.

## Do's and Don'ts

### Do:
- **Do** put recovery next to every error: what went wrong, and what to do now.
- **Do** keep focus on a meaningful element through async actions, then move it to the field that needs attention.
- **Do** theme the parts browsers draw: selection and caret use the green channel.
- **Do** use lucide icons at 16px with their default stroke.

### Don't:
- **Don't** use green or red for decoration (The Two Channels Rule).
- **Don't** use warm cream grounds or pure greys (The Cool Ink Rule).
- **Don't** add a second font family or set UI labels in a display face.
- **Don't** shadow nested elements (The One Lift Rule).
- **Don't** put marketing chrome (hero images, testimonials, badges) on product surfaces, and never invent proof.
