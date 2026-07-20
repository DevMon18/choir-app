# Choir Collective App — Master Requirements Spec (v5)

> Consolidates v2 (base spec), v3 (security/realtime/OAuth fixes), and v4
> (super admin + email/password auth) into one comprehensive functional +
> non-functional requirements checklist. Read this file first; it points
> back to v3/v4 for the actual SQL/code where relevant rather than
> repeating it. Save all four files together under `.agent/rules/`.
>
> **Definition of done for this project:** every checkbox in §1 and §2 has
> a corresponding migration, route, component, test, and monitoring signal
> — not just a database table. A feature with a table and an RLS policy
> but no test and no error handling is not done.

---

## 1. Functional Requirements

### 1.1 Authentication & Identity
- [ ] Google OAuth sign-in (existing accounts auto-verified)
- [ ] Email/password sign-up with mandatory confirmation-link verification (v4 §7)
- [ ] Unconfirmed email/password accounts cannot reach the app shell, and don't appear in the admin approval queue as approvable (v4 §7)
- [ ] `pending` → `member` / `rejected` transitions, admin-only
- [ ] `rejected` → resubmission via `/join` only, never automatic re-entry (v4 §4)
- [ ] Password reset flow (not previously specified — standard Supabase Auth recovery email)
- [ ] Session refresh handled transparently on both web and Capacitor wrapper
- [ ] Sign-out invalidates the session across tabs/devices (Supabase default — verify, don't assume)

### 1.2 Role-Based Access Control
- [ ] Six-tier role model: `super_admin`, `director`, `secretary`, `treasurer`, `member`, `pending`/`rejected` (v4 §1)
- [ ] Role-assignment hierarchy enforced at the DB layer, not just the UI (v4 §4) — Secretary cannot create Director/Super Admin; only Super Admin creates Director/Super Admin
- [ ] Self-privilege-escalation blocked at the DB layer (v3 §5.1)
- [ ] Middleware route table matches DB RLS exactly — no route accessible in the UI that RLS would silently reject, and vice versa
- [ ] Super Admin direct user-creation flow, role-assignable except `super_admin` itself (v4 §5)

### 1.3 Repertoire Hub
- [ ] ChordPro lyrics+chord entry and storage (v3 §3.3)
- [ ] ChordPro renderer with transposition and adjustable font size (prototyped)
- [ ] Optional scanned sheet-music viewer (pinch-to-zoom), independent of ChordPro content (v3 §3.3 note)
- [ ] Full-text search over lyrics (chord brackets stripped) (v3 §3.3)
- [ ] Optional full-choir reference audio upload/playback, Secretary+Director only (v3 §3.4, demoted priority)
- [ ] Song archival (soft delete via `is_archived`) rather than hard delete when referenced by a setlist (v3 §3.8 FK note)

### 1.4 Live Mass Sequence
- [ ] Director builds/reorders a setlist (`mass_sequences` + `sequence_items`) — Secretary can also build setlists (v3 §5.2)
- [ ] Director starts a live session, selects active song
- [ ] Director controls transpose and scroll speed in real time, reflected to all viewers (v3 §3.6)
- [ ] Realtime sync via `postgres_changes`, RLS-filtered, publication enabled (v3 §3.6 — **do not skip the `alter publication` step**)
- [ ] Members' devices auto-scroll or allow manual override
- [ ] Screen Wake Lock during live sessions, re-acquired on `visibilitychange` (v2 §7)
- [ ] Offline fallback: most recent sequence + songs cached for mid-Mass Wi-Fi drops (v2 §6)

### 1.5 Community Directory
- [ ] Server-masked directory view (`public_directory`), never raw `profiles`, for non-admins (v3 §3.2)
- [ ] Per-user toggle for phone/address privacy
- [ ] `emergency_contact` never exposed to non-admins regardless of toggle
- [ ] Voice-part assignment, Secretary/Director only

### 1.6 Finance (Dues)
- [ ] Treasurer/Director full CRUD on `member_dues`
- [ ] Members can view only their own dues history
- [ ] Treasurer has read access to `profiles` to attribute dues to a name (v3 §5.1)

### 1.7 Attendance
- [ ] `/admin/attendance` route, Secretary/Director (route existed in v2 middleware table; **schema for attendance itself was never defined — needs a table + RLS before this is buildable**, flagged as a gap below)

### 1.8 Recruitment / Join Flow
- [ ] Public `/join` pre-interest form, unauthenticated, writes to `join_requests`
- [ ] Staff-only read access to `join_requests` (v4 §3.8)
- [ ] Retention: auto-delete `join_requests` after 12 months with no matching profile (v4 §4)

---

## 2. Non-Functional Requirements

### 2.1 Performance
- [ ] Largest Contentful Paint < 2.5s on 4G for the `/dashboard` and `/live` routes (Core Web Vitals "good" threshold)
- [ ] Interaction to Next Paint < 200ms for chord-transpose and setlist-reorder actions
- [ ] Realtime update latency (Director action → Member screen) < 1s at expected scale (tens of concurrent devices, per v3 §5.3)
- [ ] Signed URL generation for sheet-music/audio reads adds < 300ms to initial load
- [ ] Service worker precaches app shell + last-viewed sequence so `/live` is usable within 1s on repeat visits, even offline

### 2.2 Scalability
- [ ] Current design targets tens of concurrent devices per live session (v3 §5.3); Postgres `postgres_changes` is explicitly the right call at this scale — re-evaluate only past ~500 concurrent connections per session, and only then consider Realtime Broadcast channels
- [ ] No architectural assumption blocks scaling to multiple simultaneous choirs/branches later (e.g. don't hardcode a single `live_sessions` row as "the" session — schema already supports multiple rows, keep it that way in app code)

### 2.3 Security
- [ ] RLS enabled on every table with no exceptions, including `join_requests` (v4 §3.8, gap in v2)
- [ ] No RLS policy relies on client-supplied role claims — every check re-queries `profiles` server-side
- [ ] Self-privilege-escalation and role-assignment-hierarchy triggers in place (v3 §5.1, v4 §4)
- [ ] Storage buckets default-private except `avatars`; signed URLs with 1-hour expiry for private buckets (v3 §5.5)
- [ ] Service-role key (`/lib/supabase/admin.ts`) never imported into any client component or exposed via `NEXT_PUBLIC_*` env vars
- [ ] Super Admin bootstrap credentials are environment-driven with production hard-refusal of dev defaults (this conversation's seed script)
- [ ] Google OAuth in Capacitor uses the system browser (`@capacitor/browser`), never the in-app WebView (v3 §6)
- [ ] Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `SUPER_ADMIN_BOOTSTRAP_EMAILS`, OAuth client secrets) live in platform secret storage (Vercel env vars / GitHub Actions secrets), never committed

### 2.4 Reliability & Availability
- [ ] Realtime live-session feature degrades gracefully if the WebSocket connection drops mid-Mass — reconnect with exponential backoff, show a "reconnecting" indicator rather than a blank screen
- [ ] Offline cache (§1.4) is the reliability fallback for the flagship feature specifically because live-choir use is failure-intolerant — a chorister stuck without music mid-hymn is the worst-case UX failure for this app
- [ ] Database backups: Supabase automatic daily backups at minimum; define RPO (recovery point objective) — recommend ≤24h — and RTO (recovery time objective) — recommend ≤4h for a volunteer-run org
- [ ] Storage bucket contents (sheet music, audio) included in backup scope, not just the Postgres database

### 2.5 Maintainability
- [ ] Every RLS policy and trigger lives in a numbered migration file, applied in the documented order (v3 §9, v4 §9) — no ad-hoc dashboard-applied policies that aren't captured in version control
- [ ] TypeScript strict mode across the Next.js app
- [ ] Shared Supabase client helpers (`/lib/supabase/client.ts`, `server.ts`, `admin.ts`) are the only places a Supabase client is instantiated — no ad-hoc `createClient()` calls scattered through components
- [ ] Component library (shadcn/ui) used consistently rather than one-off custom styling per screen

### 2.6 Usability & Accessibility
- [ ] WCAG 2.1 AA minimum for all Member-facing screens (Directory, Repertoire Hub, Live view) — this app serves a volunteer choir that may include older adults; accessibility isn't optional
- [ ] Minimum 48px touch targets (v2 §7, already specified — keep it)
- [ ] Performance Mode's dark palette meets 4.5:1 contrast ratio for lyric text against background
- [ ] ChordPro font-size control persists per-user (so a chorister who needs larger text doesn't reset it every session)
- [ ] Screen-reader labels on all icon-only buttons (bottom nav, transpose controls)

### 2.7 Compatibility
- [ ] Target browsers: last 2 versions of Chrome, Safari, Firefox, Edge; Android system WebView (Capacitor)
- [ ] iOS Capacitor wrapper explicitly out of scope unless requested — v2/v3/v4 only specified Android; confirm before assuming iOS parity is needed
- [ ] PWA installability verified on both Android (Chrome) and iOS (Safari "Add to Home Screen"), even without the Capacitor wrapper, since not every member will install the native app

### 2.8 Observability
- [ ] Error tracking (e.g. Sentry) wired into both the Next.js app and any Supabase Edge Functions
- [ ] Structured logging for every RLS-denial and auth failure — these are the events you'll actually need to debug ("why can't the Secretary see the roster")
- [ ] Realtime connection health surfaced somewhere admins can check it before a live Mass (a simple "last heartbeat" status, not full APM)
- [ ] Basic usage analytics (which songs get practiced, dues payment completion rate) — optional, but flag as a decision rather than an oversight

### 2.9 Data Privacy & Compliance
- [ ] Directory privacy masking is enforced server-side, never client-side-only (v2/v3, already correct — keep it)
- [ ] Data export/deletion path for a member who leaves the choir and requests their data removed (not previously specified — worth deciding: does `profiles.id → auth.users.id on delete cascade` (v3 §3.9) fully satisfy this, or do dues/attendance records need independent retention rules for accounting purposes?)
- [ ] `emergency_contact` and financial data (`member_dues`) treated as the two most sensitive fields in the schema — audit their RLS policies first in any future review

### 2.10 Testing Strategy
- [ ] Unit tests for every RLS policy — a role-matrix test suite (each role × each table × each operation) is the highest-leverage test given how much of this system's correctness lives in RLS rather than app code
- [ ] Integration test for the full pending → approved → member flow, including the email-confirmation gate (v4 §7)
- [ ] Integration test for the role-hierarchy trigger (v4 §4) — assert a Secretary-authenticated request to set someone's role to `director` is rejected
- [ ] E2E test for a full live-session flow: Director starts session → sets active song → Member's client receives the realtime update — this is the feature most likely to silently break (missing publication statement, RLS mismatch) and least likely to be caught by unit tests alone
- [ ] Since Antigravity has a built-in Browser Subagent, use it specifically for this E2E flow and for the OAuth-in-system-browser redirect — both are exactly the kind of "click through it and watch what happens" cases that are hard to unit-test but easy for an agent to visually verify

### 2.11 Deployment & Environments
- [ ] Three environments minimum: local dev, staging, production — each with its own Supabase project (never share a database across environments)
- [ ] Migration files applied identically across all three via the Supabase CLI, never hand-applied differently per environment
- [ ] `SUPER_ADMIN_BOOTSTRAP_EMAILS` and seed-script defaults differ per environment (dev fallback allowed, staging/production require explicit values — enforced by the seed script's `NODE_ENV` check from this conversation)
- [ ] CI pipeline runs the RLS role-matrix tests (§2.10) before any deploy — this is the cheapest place to catch a regression that would otherwise leak data in production

---

## 3. Known Gaps Not Yet Resolved

These were surfaced during this spec's development and don't yet have a decision — flag to the team before Antigravity builds against them:

1. **Attendance schema.** The `/admin/attendance` route has existed since v2's routing table, but no `attendance` table, columns, or RLS were ever specified. Needs: what's tracked (per-rehearsal? per-Mass? per-song within a session?), who marks it (Secretary manually, or auto-derived from live-session presence?).
2. **iOS support.** All mobile work so far (§6 across v2-v4) assumes Android/Capacitor only. Decide before building any native-only feature (Wake Lock, audio recording) whether iOS parity is in scope.
3. **Data retention for leavers.** §2.9 above — decide whether `member_dues`/attendance history is deleted alongside a departing member's `profiles` row (accounting implications) or retained independently.
4. **Analytics.** §2.8 — decide if this is wanted at all before building any tracking, given the org's privacy-conscious posture elsewhere in this spec (masked directory, private storage buckets).

---

## 4. How to Prompt Antigravity With This

Recommended approach given Antigravity's agent-and-artifact workflow:
1. Drop all four files (`spec-v2` implicit in v3, `spec-v3-antigravity.md`, `spec-v4-superadmin-addendum.md`, this file) into `.agent/rules/`.
2. Work through §9's migration order (v3) then v4 §9, one migration per agent task, reviewing each Walkthrough artifact before advancing — don't dispatch all 18 migrations as one task, Antigravity's parallel-agent model works best on independently verifiable units.
3. For §1's feature checkboxes, assign one feature area per agent dispatch (e.g. "Repertoire Hub" as one task, "Live Mass Sequence" as another) rather than one agent for the whole app — this matches Antigravity's Manager view's parallel-agent design.
4. Explicitly ask the agent to use its Browser Subagent for the two flows flagged in §2.10 (live-session realtime sync, OAuth system-browser redirect) — these are the two places a working diff can still be functionally broken in a way only interaction reveals.
5. Resolve §3's open gaps before dispatching any task that touches them — an unresolved gap handed to an autonomous agent becomes a silent assumption baked into the schema.
