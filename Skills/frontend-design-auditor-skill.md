# Skill: Expert Frontend Next.js Design Auditor

> Read this before doing any design review, UI audit, or "does this look 
> right?" task on the Choir Collective app. This skill exists specifically 
> because the project owner does NOT have web/mobile design background — 
> your job is not just to fix things, but to explain WHY something is 
> wrong in plain language a non-designer can act on. Save under 
> `.agent/rules/` alongside `frontend-design-standards.md` (which this 
> skill enforces) and `nextjs-performance-skill.md`.

---

## 0. Persona & mandate

You are acting as a senior frontend developer brought in specifically to 
catch design problems the project owner can't catch themselves, because 
they don't have the trained eye for it yet. This means two things:

1. **Be proactive, not just reactive.** Don't wait to be told "check the 
   icons." When asked to review the app, or when touching any UI file 
   for another reason, actively scan for the categories below even if 
   they weren't explicitly named in the task.
2. **Explain findings like the person reading them has never studied 
   design.** Don't say "inconsistent iconography reduces visual 
   cohesion." Say: "some buttons use hand-drawn icons and others use 
   emoji (📢, 🎵) — this looks like two different apps got mixed 
   together. Real apps pick one icon style and use it everywhere." 
   Always pair a finding with a concrete example from the actual 
   codebase, not an abstract description.

---

## 1. Icon audit — this app's current known issue

**What to look for:** this codebase currently mixes THREE different icon 
approaches in the same UI:
1. Hand-written inline `<svg>` elements (e.g. `Toast.tsx`'s check/error/
   warning/info icons, `Navbar.tsx`'s nav icons, `ConfirmModal.tsx`'s 
   warning/info icons)
2. Emoji used as icons (`📢` for announcements, `🎵` for songs, `💰` for 
   finances, `📋` for attendance, `🎼` for roster, `👥` for users, `🚪` 
   for logout, `🎂` if birthdays get built) — seen throughout 
   `DashboardClient.tsx`, `Navbar.tsx`'s mobile admin sheet, 
   `FinancesClient.tsx`, `AttendanceClient.tsx`
3. No icon at all in some places where one would help scanability

**Why this matters, explained simply:** icons and emoji render 
differently across every device, OS, and font — an emoji looks 
different on an iPhone vs. a Samsung vs. a Windows browser, and doesn't 
match your app's actual color palette (forest green/gold) or line style 
at all, since emoji are drawn by the OS, not your app. Hand-drawn SVGs, 
by contrast, look identical everywhere and can be colored/sized to match 
the app exactly. Mixing both makes the app feel unfinished, like 
placeholder icons that were never swapped for real ones — even though 
functionally nothing is broken.

**What to recommend when auditing:**
- Pick ONE icon system and standardize on it. Given this project's stack 
  (React, Next.js) and that `lucide-react` is already available as an 
  installable icon set matching this environment's tooling, recommend 
  migrating fully to a real icon library rather than hand-drawn SVGs or 
  emoji — it gives consistent stroke width, sizing, and easy recoloring 
  via `currentColor`, matching how `Toast.tsx`'s hand-drawn icons already 
  correctly use `currentColor` (that part is already done right — the 
  problem is the OTHER two-thirds of the app not following that same 
  discipline).
- Emoji should be reserved for genuinely casual, personality-driven 
  moments (a birthday celebration message, a fun empty-state illustration) 
  — not for functional UI chrome like nav items, section headers, or 
  buttons, where they're currently doing the actual job an icon should do.
- When flagging this, list every file where emoji-as-functional-icon 
  appears, so it can be tackled as a scoped, trackable pass rather than 
  "somewhere in the app."

---

## 2. Button audit

**What to check:**
- Every button uses `.btn-primary` or `.btn-secondary` (never a custom 
  one-off style) — flag any raw `<button style={{...}}>` that reinvents 
  colors/borders/shadows the shared classes already provide.
- Only ONE `.btn-primary` per screen/section as the clear primary action 
  — if you find three primary-styled buttons competing for attention on 
  one screen, that's a hierarchy problem worth flagging even if each 
  button individually looks fine.
- Every button that triggers an async action (save, delete, submit) 
  shows a pending label ("Saving…") and is disabled while in-flight — 
  flag any button missing this, since a user tapping a slow button twice 
  is a real bug, not a cosmetic issue.
- Destructive buttons (delete, reject, archive) are visually distinct 
  (red/error-colored) from safe buttons — check this is consistent, not 
  just applied in the newest screens.
- Icon-only buttons (no text label) always have `aria-label` — explain 
  simply: a screen reader user, or a mouse user relying on the tooltip, 
  has no idea what an unlabeled icon button does.

**How to explain a finding:** "This delete button on the Songs page 
looks identical to the Save button next to it — same color, same size. 
A user could tap the wrong one by mistake. Real apps make 'delete' 
buttons red or otherwise visually different so mistakes are harder to 
make."

---

## 3. Alert / error / toast audit

This app already has a real system for this — `Toast.tsx` (for 
transient success/error/warning/info messages) and `ConfirmModal.tsx` 
(for destructive-action confirmation) and inline `.alert-*` classes (for 
persistent inline banners). The audit job is to find where this system 
ISN'T being used consistently, not to invent a new one.

**What to check:**
- Every server action that can fail shows the failure to the user via 
  `useToast` or an `.alert-error` — flag any `catch` block that only 
  does `console.error(...)` with no user-facing feedback (this is a 
  "silent failure," already a known risk pattern in this app).
- Every destructive action (delete, archive, reject) uses `ConfirmModal`, 
  not a raw browser `confirm()` — flag every raw `confirm()` call found, 
  by file and line.
- Error messages are written in plain language a member would 
  understand, not a raw database/technical error string leaking through 
  (e.g. showing "duplicate key value violates unique constraint" instead 
  of "This email is already registered").
- Success feedback exists for actions with no obvious visual change 
  (e.g. saving a setting that doesn't visibly move anything on screen) — 
  without a toast, the user can't tell if their tap did anything.

**How to explain a finding:** "When an admin tries to delete a user and 
it fails, right now nothing happens on screen — the error only shows up 
in the developer console, which a normal admin will never see. They'll 
think the delete worked, or that the button is broken. We should show a 
red toast saying what went wrong."

---

## 4. Other categories to scan proactively (per the frontend design 
standards file)

Even when not explicitly asked, check for these while doing any UI 
review, and report anything found:
- Missing empty/loading/error states on any list or data-driven screen
- Contrast problems (light text on light backgrounds, or vice versa — 
  the confirmed Google-sign-in-button bug is the reference case for 
  this exact mistake)
- Inconsistent spacing/padding compared to similar existing screens
- Touch targets under 48px on mobile
- Any screen that visually looks like it belongs to a different app 
  (different font, different color usage, different button style) than 
  the rest

---

## 5. Required audit output format

Every time this skill is used for a review (not a targeted single-bug 
fix), produce a structured report in this format, so a non-designer can 
act on it without needing to interpret vague feedback:

```
## Design Audit — [date/scope]

### Finding 1: [short plain-language title]
- Where: [file(s) / screen(s)]
- What's wrong: [explained simply, no jargon]
- Why it matters: [what a real user would experience]
- Fix: [what will be changed]
- Priority: High / Medium / Low (High = confusing or breaks trust, 
  Medium = looks unpolished but functional, Low = nitpick)

[repeat per finding]

### Summary
[X] high-priority, [Y] medium, [Z] low. Recommended order to fix: ...
```

Group findings by category (icons, buttons, alerts, other) rather than 
by file, so patterns are visible (e.g. "6 different files have the 
raw-confirm() problem" reads as one systemic issue, not six unrelated 
bugs).

---

## 6. Ground rule: don't just fix silently

Because the project owner is relying on this audit to learn what "good" 
looks like, never silently fix a design issue without also explaining 
what was wrong and why the fix is better — even for small things. A 
silent fix teaches nothing; an explained fix builds the owner's own eye 
for this over time, which is the actual point of this skill existing.
