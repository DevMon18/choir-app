# Skill: Mobile UX Retention Standards (Speed, Thumb Zone, Onboarding, Navigation, Errors)

> Read this before writing or reviewing any UI code for the mobile
> (Capacitor Android / responsive web) surface of the Choir Collective
> app — new screens, modified components, or anything touching layout,
> navigation, forms, or error states. This is a standing rule, not a
> one-time task — check it every session. Save under `.agent/rules/`
> alongside `frontend-design-standards.md`,
> `frontend-design-auditor-skill.md`, and `nextjs-performance-skill.md`,
> which this skill complements rather than replaces: those files define
> *this app's* visual system (colors, tokens, components); this file
> defines *why* certain UX structural decisions matter for whether
> members actually keep using the app, and translates that into
> concrete rules against this specific codebase.

Source of the underlying research this skill is built from: Sneh Sagar,
["Mobile App UX Design Best Practices: What Actually Keeps Users Coming
Back in 2026"](https://medium.com/@sneh_sagar/mobile-app-ux-design-best-practices-what-actually-keeps-users-coming-back-in-2026-ef91ae6e478c).
The core finding worth internalizing: most apps lose the vast majority
of their users within days of install, and that's overwhelmingly a UX
problem, not a features problem — driven by four things, in order of
impact: speed, thumb-reachability, onboarding friction, and unclear
navigation, with poor error handling as a silent fifth killer at the
exact moments (login, payment, form submission) that matter most.

---

## 0. Persona

Act as a senior mobile UX engineer who treats "it renders correctly" as
the *starting* bar, not the finish line. The real question for every
screen is: **can a real member, one-handed, on a moving jeepney, with a
spotty connection, get to the thing they came for in a few seconds
without thinking?** If the answer requires a caveat, that's not
finished work.

This app already has meaningful UX infrastructure in place — a mobile
bottom tab bar, GSAP entrance animations, skeleton loading states,
toast/confirm-modal feedback, a real design token system. Don't treat
that as "already handled, ignore this skill." Audit it against the five
principles below every time you touch it, because it's easy for new
screens to quietly regress a pattern the rest of the app got right.

---

## 1. Speed Is a UX Decision, Not a Deploy-Time Afterthought

More than half of mobile users abandon something that takes longer than
a few seconds to feel responsive. That number is unforgiving, and it's
decided in the design/implementation choices, not fixed later by
"optimizing":

- **Before adding any entrance animation** (this app's GSAP
  `fromTo`/`timeline` pattern, used in nearly every `*Client.tsx`),
  check it isn't delaying *perceived* content availability. Stagger
  durations should orient around ~0.5–0.7s total, per
  `frontend-design-standards.md` — don't let a new screen's animation
  run longer just because it looks nice in isolation. Reduced-motion
  users get it instantly (`globals.css` already handles this globally
  — never bypass that media query with inline styles that skip it).
- **Every new image is `next/image`**, not a raw `<img>`, per
  `nextjs-performance-skill.md` §5 — this app has several existing
  `<img>` exceptions (avatars, gallery) already flagged as a known gap;
  don't add a new one. Uncompressed/unoptimized images are a direct,
  measurable speed tax users won't wait out.
- **Every new route gets a `loading.tsx`** with a matching skeleton
  (`src/components/skeletons/*`), per this repo's existing convention —
  a blank screen during fetch reads as "broken," not "loading," to a
  user who doesn't know your Suspense boundary is working correctly.
- **Onboarding/setup screens must be lean**, not feature-dense — see §3.
  A crowded first screen delays the moment a new member sees any real
  value, which is functionally the same failure as a slow network call.
- Audit new dependencies before adding them per
  `nextjs-performance-skill.md` §10 — bundle weight is a speed cost paid
  by every user on every load, whether or not they use that feature.

---

## 2. Design for the Thumb, Not the Mouse

Elements placed in the bottom two-thirds of the screen — the zone a
thumb reaches naturally during one-handed use — get dramatically more
engagement than elements stranded at the top, where a hand has to
stretch or reposition. Concretely, for this app:

- **This app already made the right top-level call**: `Navbar.tsx`
  implements a real bottom tab bar (`.mobile-bottom-bar`) on mobile
  instead of a hamburger-only pattern, with text labels alongside icons
  (not icon-only) — this matches the highest-leverage recommendation in
  the source material almost exactly. **Preserve this. Do not
  regress it** by adding a new primary navigation path that only lives
  in a top header/hamburger on mobile.
- **Audit every new screen's primary action placement.** Right now,
  several admin screens put the main "+ New X" action in a top-right
  header row (`SequenceManagerClient.tsx`'s "+ New Sequence",
  `SongsManagerClient.tsx`'s "+ Add Song", `AnnouncementsManagerClient.tsx`'s
  "+ Create Announcement"). On desktop that's a completely standard,
  fine pattern. **On mobile (≤768px), evaluate whether that primary
  action should also be reachable low on the screen** — e.g. a sticky
  bottom action bar or floating action button for the single most
  common action on that screen, rather than forcing a thumb-stretch to
  the top-right corner every time. This doesn't mean rebuilding every
  admin screen today — it means: when you touch one of these screens
  for other work, or build a new admin list screen, make the primary
  action thumb-reachable on mobile rather than copying the top-right
  pattern by default.
- **Touch targets stay ≥48px** — already a hard rule in
  `frontend-design-standards.md` §6 and enforced in `globals.css`'s
  mobile `@media` block (`.btn { min-height: 48px }`,
  `.input-field { min-height: 48px }`). Never introduce a smaller custom
  control. This matches the source material's 44–48px floor almost
  exactly — treat any new touch target under that as a bug, not a style
  choice.
- **Reserve top corners for back/secondary actions only** — this app
  already does this correctly in most flows (`SongViewerClient.tsx`'s
  back link, `ChatClient.tsx`'s "Inbox" back button). Keep doing it;
  don't put a *primary* action (the thing a user came to this screen to
  do) in a top corner.
- Where a list/grid has one dominant per-item action (e.g. "Message" in
  `DirectoryClient.tsx`'s member cards), keep it low in the card, not
  pinned to the top — this app already does this correctly; use it as
  the reference pattern for new cards.

---

## 3. Onboarding: Get to the First Real Win Fast

Strong onboarding meaningfully improves whether new users stick around;
weak onboarding (front-loading every feature, every permission prompt,
every setup field before any payoff) is one of the biggest reasons
people never come back after install. Applied to this app:

- **`/join`'s application form is long** (name, email, contact number,
  voice part, address, availability, choir experience, reason for
  joining — 8 required fields on one screen). This is appropriate for a
  *membership application* (it's gatekeeping, not casual onboarding —
  don't "fix" it by making joining the choir frictionless, that's a
  different product decision than UX polish). But if any *future*
  onboarding-style flow is added post-approval (e.g. a first-run profile
  setup wizard, a "welcome, here's how to use the app" flow), apply
  progressive disclosure — 3–5 screens max, one concern per screen, per
  the source material — rather than one long form.
- **This app already does permission-request-in-context correctly**:
  `PushNotificationManager.tsx` shows a dismissible banner asking to
  enable push notifications contextually on the dashboard, rather than
  demanding it at launch, and the mic-recording flow (per the practice
  recordings addendum) should follow the same pattern — request
  `getUserMedia` only when the member actually taps "Record," never
  proactively on page load. **Preserve this pattern for any new
  permission-gated feature** (camera, location, contacts) — always
  request at the moment of use, never upfront.
- **Account creation is already appropriately deferred** in the sense
  that browsing isn't possible pre-approval by design (this is a closed
  membership app, not a consumer app trying to reduce signup friction) —
  don't misapply "defer account creation" from the source material here;
  it doesn't fit this app's actual access model. Use judgment about
  which source recommendations map to this app's context and which
  don't — this is one that doesn't.
- If a first-run tutorial/tooltip system is ever added, follow the "get
  to first meaningful win in under 60 seconds" principle: show the
  choir member their next rehearsal date or an active announcement
  immediately, don't walk them through every nav tab before letting them
  do anything.

---

## 4. Navigation That Needs Zero Explanation

The moment a user has to pause and figure out where to go, you've
already lost — not because features are missing, but because the path
to them isn't obvious. For this app:

- **Bottom tab labels stay text + icon, never icon-only** — already
  correct in `Navbar.tsx`'s `.mobile-tab` (each has a `<span>` label).
  Any new tab added to the bottom bar must follow the same pattern.
- **Bottom nav tab count has a hard ceiling of 5** — this app is
  currently *exactly* at that ceiling (Home, Messages, Calendar,
  Directory, Menu). **Do not add a 6th bottom tab.** If a new
  top-level destination is needed, it goes inside the "Menu" bottom
  sheet (`mobile-sheet-panel`), not onto the tab bar itself.
- **Never intercept the system back gesture** on Android. Any new modal,
  drawer, or full-screen overlay must close on the hardware/gesture back
  action the way a user expects, not trap them. When building new
  full-screen mobile views (e.g. a future full-screen lyrics/practice
  mode), verify this explicitly on a real device or emulator, not just
  assumed from web behavior.
- **Swipe gestures must stay consistent app-wide.** `PhotoGallery.tsx`
  already establishes swipe-left/right = next/previous photo, in both
  the grid and the lightbox. Any new swipeable surface (e.g. a future
  swipe-between-songs-in-a-sequence view) should reuse that same
  left/right = next/previous convention, not invent a different mapping.
- Route destinations reachable from a push-notification tap or deep link
  need real navigation, per the standing rule already in
  `spec-v5-master-requirements.md` §4F — a route that only exists in the
  Next.js router but has no matching native intent-filter is invisible
  outside the in-app context.

---

## 5. Errors Are Part of the UX, Not an Afterthought

A vague error at a critical moment — login, dues payment, form
submission — is frequently the last thing a user sees before they give
up on the app entirely. This is where this skill overlaps directly with
this repo's existing "no silent failures" standing rule
(`spec-v5-master-requirements.md` §4H) and the alert/toast audit in
`frontend-design-auditor-skill.md` §3 — treat all three as one
requirement, not three separate ones:

- **Every error message must say what went wrong AND how to fix it.**
  "Something went wrong" is a failure state, not a message. Compare the
  existing good example in `login/actions.ts` (`error.message` from
  Supabase is already reasonably specific) against a generic catch-all —
  when writing a new `catch` block, don't default to a vague string;
  write the specific, actionable version.
- **Every failure surfaces to the user**, via `useToast` or
  `.alert-error`, never only `console.error`'d — per the standing rule,
  this is non-negotiable, not a nice-to-have.
- **Payment/login/critical-form errors get extra care.** For this app
  that means: dues-payment recording failures in
  `FinancesClient.tsx`/`toggleSinkingFund`, login failures in
  `login/page.tsx`, and join-application submission failures in
  `join/page.tsx` are the highest-stakes error surfaces in the app —
  when touching these flows, double-check the error text actually tells
  the member what to do next (e.g. "This email is already registered —
  try signing in instead" beats a raw Postgres constraint message,
  which this app already does correctly in `join/actions.ts`'s `23505`
  handling — use that as the template for new form error handling).
- **One narrow, documented exception**: the password-reset-request flow
  intentionally returns a generic success message regardless of whether
  the email exists, to prevent account enumeration (see the Resend
  password-reset addendum, §4). That's a deliberate security trade-off,
  not a violation of this rule — don't "fix" it into leaking account
  existence, and don't use it as precedent for vague errors anywhere
  else.

---

## 6. Content Sizing — Readable, Not Cramped, Not Oversized

The source article doesn't cover this directly, but it's the same
underlying problem as the thumb zone: content sized for a desktop
mockup, not for a small screen held at arm's length. This app already
has a partial typography scale defined in
`frontend-design-standards.md` §8 ("Mobile Typography & Sizing
Standards"), but it's currently scoped only to the named consumer
screens (Directory, Profile, DMs, Photo Gallery, Calendar). Treat that
scale as the baseline for **every** mobile screen, admin included, not
just the ones it happens to list:

- **Reuse the existing scale, don't invent a new one per screen**: body
  text 14–15px, primary names 15–16px semibold, profile header names
  18–20px bold, secondary/meta text 12–13px in `var(--muted)`, section
  labels 11–12px uppercase/letterspaced, button text 14–15px. When
  building a new mobile card/list view (including admin ones — e.g. a
  future mobile-optimized card for `SongsManagerClient` or
  `AttendanceClient`), pull from this same scale rather than picking
  new sizes that feel right in isolation.
- **Never drop form input font-size below 16px on mobile.** This app's
  `.input-field` already sets `font-size: 16px` inside the mobile
  `@media` block specifically to stop iOS Safari's automatic zoom-on-
  focus — a real, previously-solved bug in this codebase. Any new custom
  input must inherit this, never override it smaller.
- **Don't shrink type to cram in more content.** If a screen feels
  dense, the fix is progressive disclosure or the existing card/table
  collapse pattern (`.custom-table`'s mobile transformation from a wide
  table into stacked cards, already implemented) — not reducing font
  size below the floor above to fit more onto one screen. Shrinking text
  to fit more is the failure mode this rule exists to prevent, not a
  valid space-saving technique.
- **Line-height stays generous for anything read at length** — `~1.5–1.6`
  for body copy and lyrics. `ChordProRenderer.tsx` already uses
  `lineHeight: 1.6` for lyric rendering; treat that as the reference
  value for any new long-form text block (announcement bodies, choir
  experience/reason text in join-request review modals, etc.), not just
  lyrics specifically.
- **Never disable pinch-zoom or block device text-scaling.** Check any
  viewport meta configuration (in `layout.tsx` or elsewhere) for a
  `maximum-scale=1` or `user-scalable=no` restriction — if one is ever
  introduced, remove it. Blocking zoom is a real accessibility
  regression for low-vision users, not a polish choice, regardless of
  how it affects visual "tidiness."
- **Images and embedded media must be sized responsively**, never with
  fixed pixel dimensions that exceed the viewport and force horizontal
  scroll — this is a content-sizing issue as much as it's the
  performance issue already covered in §1; a `next/image` with
  appropriate `sizes` handles both at once.
- **Spacing/padding follows the same "reuse, don't invent" rule** as
  typography — per `frontend-design-standards.md` §2, check 2–3 existing
  similar components for their actual `gap`/`padding` values before
  choosing new ones for a new screen.

---

## 7. The Metric This All Serves

If a build/redesign decision is ambiguous, the tie-breaker question is:
**does this help a member come back a week from now?** Day-7 return
behavior is the signal that the app has become part of someone's actual
rehearsal/Mass routine rather than a one-time install. All five sections
above feed that number — speed and thumb-friendliness determine whether
someone finishes their first session at all; onboarding and navigation
determine whether they understand what to do next time; error handling
determines whether a single bad moment (a failed dues payment, a login
error) is the reason they stop trying.

This isn't something to instrument right now — no analytics work is
implied by this skill — it's the mental model to hold when a UX
trade-off isn't obvious.

---

## 8. Pre-Ship Checklist — run this before calling any mobile UI work done

1. Does anything on this screen make a user wait longer than necessary
   to see real content (heavy animation, unoptimized image, missing
   `loading.tsx`)?
2. Is the primary action on this screen reachable in the bottom
   two-thirds of the screen on mobile, or does it force a top-corner
   reach?
3. Are all touch targets ≥48px — verified, not assumed?
4. If this screen is a setup/first-run flow: does it get the user to a
   real payoff in a handful of screens, not a long unbroken form (unless
   it's a deliberate gatekeeping form like `/join`, which is exempt by
   design)?
5. Is every permission request (mic, camera, push, location) triggered
   at the moment of use, never upfront at launch?
6. Does the bottom tab bar still have ≤5 tabs, with text labels, and
   does the system back gesture still work everywhere on Android?
7. Does every failure path on this screen show a specific, actionable
   message via `useToast`/`.alert-error` — not a silent console log, and
   not a generic "something went wrong"?
8. Does text on this screen match the existing mobile typography scale
   (§6), stay ≥16px on form inputs, and avoid being shrunk just to fit
   more content into a small space?
9. Would a real member, one-handed, on a slow connection, get to what
   they came for here without pausing to figure it out?

If the answer to any of these is "no" or "not sure," the work isn't
done yet — fix it before reporting the task complete.
