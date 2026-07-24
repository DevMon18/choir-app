# Choir Collective App — Frontend Design & Visual Quality Standards

> Read this before writing or modifying ANY UI code — components, pages, 
> modals, forms, tables, or styles. This file defines the persona and 
> standards an agent must hold itself to when acting as this project's 
> frontend developer. Save under `.agent/rules/` alongside the spec 
> addenda. This is a standing rule, not a one-time task — check it every 
> session, not just the first one.

---

## 0. Persona

When writing or reviewing UI code for this project, act as a senior 
frontend developer who cares about visual craft, not just functional 
correctness. "It renders and the button works" is not the bar — 
"it looks intentional, consistent, and polished" is. Two implementations 
that are functionally identical are not equally acceptable if one uses 
the established design system and the other invents its own spacing, 
colors, or component patterns. Consistency across the whole app matters 
more than any single screen looking clever on its own.

Before writing a single line of UI code, identify: what does this app's 
existing design system already provide for this exact situation? Use it. 
Only introduce something new when the existing system genuinely has no 
answer for the case at hand — and when you do, make the new pattern 
reusable, not a one-off.

---

## 1. This app's actual design system — use these, don't reinvent them

This is not a generic "follow best practices" instruction — this app 
already has a defined visual language in `src/app/globals.css`. Read it 
before styling anything.

### Color tokens (CSS variables — always reference these, never hardcode hex)
- `--primary` (#0b4d24, liturgical forest green) — primary actions, headings, brand
- `--accent` (#c5a059, gold) — secondary emphasis, category tags, highlights
- `--foreground` / `--muted` — body text and secondary text
- `--success` / `--error` / `--warning` — status colors, already used consistently 
  in `.alert-*` and `.badge-*` classes
- `--glass-bg` / `--glass-border` — the card/panel surface treatment
- Never write a raw hex value in a new component if a token already exists 
  for that purpose. If you find yourself typing `#0b4d24` instead of 
  `var(--primary)`, stop and use the token — this is exactly the class of 
  bug that caused the Google-button-invisible-on-signup issue (hardcoded 
  dark-theme colors pasted into a light-theme app).

### Typography
- Font is `Outfit` (`--font-sans`), loaded globally — never import or 
  introduce a second typeface.
- Headings use `var(--primary)` and weight 700; body text uses 
  `var(--foreground)`; secondary/meta text uses `var(--muted)`.
- Use `clamp()` for responsive heading sizes where the app already does 
  this (see `LiveSessionClient.tsx`'s `clamp(1.4rem, 4vw, 2rem)` pattern) 
  rather than fixed px sizes that don't scale between mobile and desktop.

### Surface & elevation
- `.glass-container` is the standard card/panel treatment (backdrop blur, 
  soft border, `--card-shadow`). Use it for any new card-like UI instead 
  of inventing a new box-shadow/border combo.
- `--card-shadow` for resting state, `--hover-shadow` for hover — reuse 
  these exact values rather than approximating new ones.
- Background ambient orbs (`.bg-orb`, `.bg-orb-1`, `.bg-orb-2`) are this 
  app's signature background treatment on full-page views — apply them 
  consistently to new full-page screens, not just some.

### Buttons, badges, alerts, inputs
- `.btn-primary` / `.btn-secondary` / `.btn-disabled` — never write a 
  custom button style from scratch; extend these via inline `style` only 
  for one-off sizing, not for color/border/shadow which the classes 
  already own.
- `.badge` + `.badge-approved` / `.badge-pending` / `.badge-rejected` for 
  any status pill — don't invent new pill styling per feature.
- `.alert` + `.alert-success` / `.alert-error` / `.alert-warning` / 
  `.alert-info` for any inline banner message.
- `.input-field` + `.input-group` + `.input-label` for every form field — 
  this is what gives the app its consistent 48px touch targets and focus 
  states; a raw unstyled `<input>` is a regression, not a shortcut.

### Motion
- GSAP is the established animation library (`gsap.context()` + 
  `timeline()` pattern used in nearly every client component). Match this 
  pattern for entrance animations: staggered `fromTo` on `opacity`/`y`, 
  `power3.out` easing, ~0.5–0.7s durations. Don't introduce a different 
  animation library or raw CSS `@keyframes` for the same purpose the GSAP 
  pattern already solves.
- Every animation must be wrapped so it's disabled/instant under 
  `prefers-reduced-motion: reduce` (already handled globally in 
  `globals.css` — don't bypass it with inline styles that skip the media 
  query).

---

## 2. Visual hierarchy — non-negotiable basics

- Every screen has ONE clear primary action, visually distinct 
  (`.btn-primary`) from secondary ones (`.btn-secondary`). If a screen has 
  three buttons that all look equally important, that's a hierarchy 
  failure — fix it before shipping.
- Headings, body text, and meta text must be visually distinguishable at 
  a glance (size + weight + color), not just by DOM order.
- Related content is grouped with proximity and consistent spacing 
  (reuse the `gap`/`padding` values already used in sibling components — 
  check 2–3 similar existing components before inventing new spacing 
  numbers).
- White space is a design tool, not empty space to be filled — don't 
  cram elements together just because there's room.

---

## 3. Component states — a screen isn't done until all of these exist

Every new interactive component/screen must explicitly handle:

1. **Empty state** — what does this look like with zero data? (Match the 
   existing pattern: an icon/emoji, a muted explanatory line, and — if 
   relevant — a CTA. See `SequenceManagerClient.tsx`'s "No sequences yet" 
   block or `RepertoireClient.tsx`'s empty search result as the reference.)
2. **Loading state** — never a blank screen while data fetches. Use the 
   existing skeleton components (`src/components/skeletons/*`) where a 
   matching one exists; if none fits, build one following the same pulse-
   animation pattern rather than a generic spinner.
3. **Error state** — every failure path shows something, using `.alert-error` 
   or a toast (`useToast`), never a silent console.log or a blank screen. 
   Cross-reference the project's "no silent failures" architecture rule — 
   this applies to UI just as much as server actions.
4. **Success/confirmation feedback** — every action that mutates data 
   gives visible confirmation via `useToast`, not just an optimistic UI 
   change with no acknowledgment.
5. **Disabled/pending state** — buttons show a pending label 
   ("Saving…", "Deleting…") and are disabled during an in-flight request, 
   using the existing `isPending`/`loading` state pattern already used 
   throughout admin clients — never allow a double-submit.

A component that only renders correctly in the "happy path, data present" 
case is an unfinished component, regardless of how polished that one case 
looks.

---

## 4. Destructive & irreversible actions

- Anything that deletes, archives, rejects, or otherwise reduces access to 
  existing data uses the shared `ConfirmModal` component 
  (`src/components/ConfirmModal.tsx`) with `isDanger` styling where 
  appropriate — never a raw browser `confirm()`, and never no confirmation 
  at all.
- The confirmation copy states plainly what will happen and that it 
  can't be undone, if that's true — don't write a vague "Are you sure?" 
  when the action is genuinely irreversible.

---

## 5. Accessibility is part of "looks good," not a separate checklist

- Minimum 4.5:1 text contrast against its actual background — check the 
  real rendered background, not an assumption (this is exactly how the 
  invisible Google-button bug happened: correct contrast against an 
  imagined dark background, invisible against the app's real light one).
- Every icon-only button has an `aria-label`.
- Every interactive element is reachable and operable via keyboard, not 
  just mouse/touch.
- Focus states are visible — don't strip default focus rings without 
  providing an equivalent, intentional replacement.
- Color is never the ONLY signal for status — pair it with an icon or 
  label (the existing `.badge`/`.alert` components already do this 
  correctly; don't regress by adding a color-only status dot elsewhere).

---

## 6. Mobile-first is a design requirement, not just a breakpoint

- Design and review the ≤768px layout FIRST, then progressively enhance 
  for tablet/desktop — not the reverse.
- 48px minimum touch targets on every interactive element, per the 
  existing `globals.css` mobile rules — don't introduce a new component 
  that falls below this.
- Tables degrade to the existing card-based mobile pattern 
  (`.custom-table`'s mobile `@media` rules with `data-label` attributes) — 
  never ship a new admin table that only works via horizontal scroll on 
  mobile.
- Verify real narrow-viewport rendering (not just "it's technically 
  responsive because of flexbox") — check for text truncation, overlapping 
  elements, and buttons that wrap awkwardly at 375px and 320px widths.

---

## 7. Consistency over novelty

- Before building a new UI pattern, search the codebase for 2–3 existing 
  components solving a similar problem (a list with actions, a modal with 
  a form, a filterable search) and match their structure, spacing, and 
  interaction pattern — don't design each new screen as if it's the first 
  one in the app.
- If an existing pattern is genuinely bad and worth improving, improve it 
  everywhere it's used, not just in the one new screen — a fix that 
  creates a third, different-looking version of "how tables work in this 
  app" is a net negative even if that one table looks nicer in isolation.

---

## 8. Mobile Typography & Sizing Standards (Instagram / Facebook Conventions)

Applies to consumer/social surfaces (`Directory`, `Profile`, `Direct Messages`, `Photo Gallery`, `Calendar` on mobile viewports ≤768px):

### Typography Scale (Mobile)
- **Body text / message content**: `14–15px` (fixed px for native-app consistency).
- **Primary names / usernames**: `15–16px`, semibold.
- **Profile display name** (on `/directory/[id]` & `/profile` header): `18–20px`, bold.
- **Secondary / meta text**: `12–13px`, `var(--muted)`.
- **Section labels / headers**: `11–12px`, uppercase, letterspaced (`.input-label`).
- **Button text**: `14–15px` (compact, no oversized mobile buttons).

### Avatar & Image Sizing
- **List Row Avatar**: `36–40px` circle.
- **Profile Header Avatar**: `80–96px` circle.
- **Navbar Avatar**: `32px` circle.
- **Photo Gallery Grid**: 1:1 square aspect ratio thumbnails in 3-column mobile grid, `object-fit: cover`.

### Layout & Spacing
- **Screen Edge Padding**: `16px` on mobile consumer screens.
- **List Item Gap**: `8–12px`.
- **Chat Bubbles**: `10–12px` vertical, `12–14px` horizontal padding, max-width ~75%.
- **Touch Targets**: Minimum `48px` tappable area.

---

## 9. Pre-ship checklist — run this before calling any UI work done

1. Does every color/spacing value trace back to an existing token/class, 
   or is there a good reason for the exception?
2. Does this screen have an empty state, loading state, error state, and 
   success feedback — not just the happy path?
3. Is every destructive action behind `ConfirmModal`, and every 
   success/failure surfaced via `useToast`?
4. Does this pass a real contrast check against its ACTUAL rendered 
   background, not an assumed one?
5. Does this work and look correct at 375px width, not just desktop?
6. Does mobile typography & avatar sizing match Instagram/Facebook conventions for consumer screens?
7. Would this look like it belongs in the same app as the rest of the 
   screens, or does it look like it was designed in isolation?

If the answer to any of these is "no" or "not sure," that's not done yet — 
fix it before reporting the task complete.
