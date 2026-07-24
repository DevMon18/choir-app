# Choir Collective App — v6 Addendum: Agent Rules & Cross-Platform Sync

> Read alongside `spec-v5-master-requirements.md` — this file only adds to
> and redlines that spec based on real bugs found in production (mobile
> OAuth stranding, silent RLS no-op on self-profile-update, dead legacy
> FCM endpoint). Save this alongside v2-v5 under `.agent/rules/`. Don't
> merge by hand — this file states precisely what changes on top of v5.

---

## 0. Why this addendum exists

Three bugs were found post-launch that the v5 spec either didn't fully
cover or flagged but didn't make specific enough to prevent:

1. Google OAuth on the Capacitor Android APK opens the system browser
   correctly, but never returns control to the app afterward — the user
   is stranded on the web page inside the browser tab.
2. A `member`-role user editing their own profile (avatar, phone,
   address) gets a success toast, but the write silently doesn't
   persist — RLS filters the `UPDATE` to zero rows, and Supabase-js does
   not raise an error for that, so the server action reports success
   anyway.
3. Native push notifications (`src/lib/push.ts`) call the legacy FCM
   HTTP API (`fcm.googleapis.com/fcm/send`), which Google decommissioned
   in June 2024. Failures are only `console.error`'d server-side and
   never surfaced, so this looked identical to "notifications just don't
   work" with no diagnostic trail.

All three share the same shape: a plausible-looking success path that
hides a real failure, on a system with more than one deployment surface.
The rules below exist to stop that shape of bug from recurring, and to
close the specific spec gaps that let these three slip through.

---

## 1. New Functional Requirement — §1.9 Announcements & Push Notifications

This section did not exist in v5. `announcements`, `fcm_tokens`, and
`push_subscriptions` are real, shipped features (see migrations
`20260722000000`–`20260722000003`) that were built without ever being
tracked in the spec — which is exactly how a dead API endpoint went
unnoticed. Add:

- [ ] Announcements CRUD, Director/Secretary/Super Admin only, with
      `priority` (normal/urgent), `is_pinned`, and optional `ends_at`
      expiry (already implemented — bring under spec tracking)
- [ ] **Two independent, both-required delivery paths** for every
      announcement broadcast:
  - [ ] Web Push (`public/sw.js` + VAPID keys) for browser subscribers
  - [ ] Native FCM (`@capacitor/push-notifications`) for the installed
        Android APK, via **FCM HTTP v1** (service-account + short-lived
        OAuth2 token) — **never** the legacy `fcm.googleapis.com/fcm/send`
        server-key endpoint, which is permanently retired
- [ ] A broadcast is not "sent" unless both paths are attempted and
      their individual success/failure is logged distinguishably — a
      feature that silently only implements one path is an incomplete
      implementation, not a partial success
- [ ] Push/broadcast failures are returned to the admin UI (even just a
      warning toast), not only `console.error`'d server-side
- [ ] Expired/invalid push subscriptions and FCM tokens are pruned on
      send failure (404/410), not accumulated indefinitely

---

## 2. Redline — §2.3 Security (v5)

v5 currently states:

> Google OAuth in Capacitor uses the system browser (`@capacitor/browser`), never the in-app WebView (v3 §6)

This checkbox is necessary but not sufficient, and its current wording
is exactly vague enough that "we installed `@capacitor/browser`" reads
as done when the actual OAuth loop was never closed. Replace with:

- [ ] Google OAuth in Capacitor uses the system browser
      (`Browser.open()` from `@capacitor/browser`) to launch the OAuth
      URL — never the in-app WebView, and never a bare server-side
      `redirect()` (`redirect()` is a web-only assumption that strands
      native users in the browser tab with no way back into the app)
- [ ] A custom URL scheme / deep link is registered in
      `android/app/src/main/AndroidManifest.xml` for the OAuth
      callback, and an `appUrlOpen` (`@capacitor/app`) or
      `browserFinished` listener explicitly calls `Browser.close()` and
      resumes the app at `/dashboard` once the callback fires
- [ ] This full loop — launch, redirect, deep link, close, resume — is
      verified on a real device or emulator for cold-start (app fully
      closed) and warm-start (app backgrounded) cases, not just "the
      browser opened"

---

## 3. §3 Known Gaps — two additions

v5 §3 lists four known gaps (attendance schema, iOS support, data
retention, analytics). Add:

**5. Mobile OAuth return-trip.** Opening the system browser for Google
sign-in was implemented; resuming the native app afterward was not.
There is no deep link, no `appUrlOpen` listener, and no
`Browser.close()` call anywhere in the codebase. This is a gap in
implementation completeness, not just a missing checkbox — treat as a
required fix before any further native-auth work, not a nice-to-have.

**6. Self-service data edits under RLS.** Every RLS-related requirement
in v5 (§2.3, §1.2) is framed around admin-vs-admin or admin-vs-member
access. Nowhere does the spec explicitly require "a member can update
their own profile row," and no table's RLS policy set actually grants
it — `profiles` currently only allows admin roles to `UPDATE`, with no
`auth.uid() = id` policy for self-edits. Any future table storing
user-editable, non-admin-owned data (preferences, personal notes, etc.)
must have this called out explicitly per-table, not assumed to be
covered by a general RLS pass.

---

## 4. Standing Agent Rules (apply to all future work, not just the bugs above)

These are architecture-level rules, not feature-specific ones — every
agent session working on this codebase should treat them as always-on,
regardless of what the current task is.

### A. Three deployment surfaces, one codebase
This app ships as a Next.js web app (Vercel), a Capacitor-wrapped
Android APK (WebView pointed at the deployed site, `capacitor.config.ts`
`server.url`), and a Supabase backend, accessed via three different
clients (`src/lib/supabase/client.ts` browser, `server.ts` server/RLS,
`admin.ts` service-role/bypasses-RLS). Before starting any feature,
state which of these three surfaces it touches, and don't assume a fix
on one automatically covers the others.

### B. RLS & data access
- Every table gets RLS enabled with an explicit policy per role **and**
  an explicit "user acts on their own row" policy
  (`auth.uid() = owner_column`) — this is a default case to design for,
  not an edge case to bolt on later.
- Supabase-js does not throw when RLS silently filters a write to zero
  rows. Any server action that writes user-visible data must confirm
  the write with `.select()` and treat an empty result as a failure,
  not a success.
- The service-role admin client (`src/lib/supabase/admin.ts`) is
  server-action-only, after re-verifying the caller's role server-side.
  Never in a client component, never behind `NEXT_PUBLIC_*`.
- New role-sensitive triggers must be cross-checked against every
  existing policy touching `profiles.role` so a new feature can't open
  an escalation path.
- All schema/policy/trigger changes are new, timestamp-ordered files
  under `supabase/migrations/` — never a hand-applied dashboard change.

### C. Auth & native branching
- Any change to login/signup/redirect logic must explicitly branch on
  `Capacitor.isNativePlatform()`. A bare `redirect()` is a web-only
  assumption. Native OAuth requires `Browser.open()` +
  deep-link/`appUrlOpen` handling to hand control back to the app — see
  §2 above as the reference case for what "done" looks like.
- Role/permission checks are re-verified server-side on every
  privileged action, even when the UI already hides the option —
  `src/proxy.ts`'s route table and each table's RLS policies are the
  real enforcement layer and must agree with each other.

### D. Realtime
- Any feature using `postgres_changes` must confirm its table is in the
  `supabase_realtime` publication — a missing `ALTER PUBLICATION` is a
  silent, hard-to-diagnose failure.
- Realtime UI must handle disconnect/reconnect explicitly (backoff +
  visible "reconnecting" state), especially on mobile where network
  switching and backgrounding are routine, not exceptional.

### E. Notifications
- Web Push and native FCM are two independent, both-required paths —
  see §1 above. A change to one without considering the other is
  incomplete.
- Always use current, non-deprecated integration APIs (FCM HTTP v1 with
  a service-account OAuth token). When touching any external
  integration, confirm the credential type and API version are current
  before assuming a bug is "just a config problem" — deprecated
  integrations fail in ways indistinguishable from misconfiguration.

### F. Native-only capabilities
- Browser-only APIs (localStorage, Wake Lock, camera/file picker,
  clipboard, geolocation, vibration) need a Capacitor plugin equivalent
  for parity in the wrapped APK, with graceful degradation — not a
  silent no-op inside the WebView.
- Routes reachable via a push-notification tap or OAuth/deep-link
  redirect need a matching intent-filter / URL scheme in
  `android/app/src/main/AndroidManifest.xml` — a route that only exists
  in the Next.js router is invisible to the native OS.

### G. Mobile-first responsive design
- Every new page/component is designed mobile-first (≤768px layout
  first, then progressively enhanced), per the existing `mobile-design`
  skill reference in `AGENTS.md`.
- Minimum 48px touch targets; reuse existing `.btn`/`.input-field`
  sizing rather than introducing smaller custom controls.
- New data tables degrade to the existing card-based mobile pattern
  (`.custom-table`'s mobile `@media` block), not raw horizontal scroll.
- Respect `prefers-reduced-motion` for any new animation.
- Reuse existing design tokens (`var(--primary)`, `.glass-container`,
  `.badge`, etc.) instead of one-off inline styles, unless the
  component is a deliberate one-off.

### H. No silent failures
- No server action returns `{ success: true }` (or omits an error
  field) unless the underlying write/send was verifiably confirmed —
  "didn't throw" is not confirmation.
- Any `catch` block that only `console.error()`s without surfacing the
  failure to the caller is an incomplete implementation, not a
  finished one — upgrade it to return an actionable result.

---

## 5. Definition of Done (extends v5's project-level DoD)

v5's DoD requires a migration, route, component, test, and monitoring
signal per checkbox. Add: a feature is not done until you can answer
**yes** to all of the following, in addition to v5's criteria:

1. Does it work correctly under RLS as the least-privileged role that
   should have access — not just as `super_admin` during testing?
2. Does it behave correctly on both the web deployment and the
   Capacitor Android build, including any native-only branching?
3. Is every failure path surfaced or logged in a way that's actually
   actionable, not silently swallowed?
4. Is the mobile (≤768px) layout verified, not assumed to inherit from
   desktop?
5. If it touches auth, notifications, or realtime — have **all**
   relevant delivery/return paths been implemented, not just the one
   that was easiest to test?

---

## 6. Migration / Task Order (extends v5 §4's dispatch guidance)

Recommended next dispatches, in priority order, given what's now known:

1. Fix `public.profiles` self-update RLS gap (§3 item 6) — add
   `auth.uid() = id` UPDATE policy, cross-checked against the
   role-hierarchy triggers; fix `updatePersonalProfile` to verify
   writes via `.select()`.
2. Migrate `src/lib/push.ts` off legacy FCM to HTTP v1 (§1); surface
   send failures to the admin UI.
3. Close the mobile OAuth loop (§2 / §3 item 5) — `Browser.open()` +
   deep link + `appUrlOpen` listener + `Browser.close()`.
4. Only after 1–3: resume new feature work, applying §4's standing
   rules and §5's DoD to everything going forward.
5. Backfill the RLS role-matrix test suite (v5 §2.10, already flagged
   there as highest-leverage) — prioritize `profiles` given item 1 just
   proved it was untested and broken.