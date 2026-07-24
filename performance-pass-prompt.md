Task: performance pass on data fetching and perceived load speed across the 
Choir Collective app. This is an optimization/cleanup task, not new feature 
work — do not change business logic or UI design, only fetch-timing and 
loading-state behavior.

Read AGENTS.md and any spec-v*.md / addendum files in .agent/rules/ first, 
including the frontend design standards file, before touching anything.

============================================================
PART A — Parallelize independent sequential data fetches
============================================================
Known confirmed case to start with: src/app/calendar/actions.ts's 
getCalendarEvents() currently runs three independent Supabase queries 
(mass_sequences, attendance_sessions, announcements) as sequential 
`await` calls, one after another, even though none of them depend on 
each other's results. Convert this to Promise.all so all three fire 
concurrently instead of paying three round-trips back to back:

  const [massResult, sessionResult, annResult] = await Promise.all([
    supabase.from('mass_sequences').select(...),
    supabase.from('attendance_sessions').select(...),
    supabase.from('announcements').select(...),
  ]);

Then audit the REST of the codebase for the same pattern — any 
server component (page.tsx) or server action that makes two or more 
`await supabase.from(...)` calls back to back where the queries don't 
depend on each other's output. Known likely candidates to check first, 
based on existing multi-query pages:
- src/app/admin/analytics/page.tsx (fetches profiles, member_dues, 
  attendance_sessions, attendance_records, songs, sequence_items — several 
  of these are almost certainly independent and safe to parallelize)
- src/app/admin/sequences/page.tsx (fetches sequences, songs, 
  active session)
- src/app/live/page.tsx (fetches active session, active song, all songs, 
  sequence items — note: active song fetch DOES depend on active session 
  result, so that one dependency must stay sequential; only parallelize 
  the parts that are genuinely independent)
- src/app/admin/finances/page.tsx (fetches invoices + members)

For each file changed, confirm before converting to Promise.all that the 
queries are truly independent (a later query doesn't use a value from an 
earlier query's result) — do not parallelize a genuinely dependent chain, 
that would introduce a bug, not a speedup.

============================================================
PART B — Add loading.tsx + wire existing skeleton components
============================================================
This app already has skeleton components 
(src/components/skeletons/DashboardSkeleton.tsx, CalendarSkeleton.tsx, 
TableSkeleton.tsx) but they are not wired into Next.js App Router's 
Suspense/loading convention via loading.tsx files, so navigation currently 
shows a frozen/blank state instead of an instant skeleton while the server 
component's data fetch is in flight.

For every route under src/app/ that has a page.tsx doing an async data 
fetch (essentially all the `export const dynamic = 'force-dynamic'` pages), 
add a sibling loading.tsx that renders the matching existing skeleton 
component, or a new lightweight skeleton following the same pulse-animation 
pattern if no matching one exists yet. Specifically:
- src/app/dashboard/loading.tsx → DashboardSkeleton
- src/app/calendar/loading.tsx → CalendarSkeleton
- src/app/admin/users/loading.tsx, admin/roster/loading.tsx, 
  admin/attendance/loading.tsx, admin/finances/loading.tsx, 
  admin/songs/loading.tsx, admin/sequences/loading.tsx, 
  admin/announcements/loading.tsx, admin/analytics/loading.tsx → 
  TableSkeleton (adjust rows prop sensibly per page) or a new matching 
  skeleton if the page's layout doesn't fit a table shape (e.g. 
  sequences/analytics may need their own skeleton variant — use judgment, 
  but keep the same visual pulse-animation language as the existing 
  skeletons rather than a generic spinner)
- src/app/repertoire/loading.tsx, repertoire/[id]/loading.tsx, 
  directory/loading.tsx, dues/loading.tsx, live/loading.tsx → new 
  lightweight skeletons matching each page's actual layout shape, following 
  the same pulse-animation pattern as the existing skeleton components

Each loading.tsx should be a simple server component (no 'use client' 
needed) that just renders the skeleton, matching how Next.js App Router 
automatically shows it via Suspense during the page's data fetch — no 
manual wiring required beyond creating the file in the right location.

============================================================
General constraints
============================================================
- Do not change any query logic beyond the Promise.all conversion — same 
  filters, same selected columns, same error handling per query.
- Confirm error handling still works correctly after parallelizing — if 
  one query in a Promise.all fails, decide (and state explicitly) whether 
  the page should still render with partial data (current behavior mostly 
  logs errors and falls back to empty arrays) or fail entirely, and keep 
  that behavior consistent with what each page already does today.
- Do not introduce new dependencies — use built-in Promise.all and Next.js's 
  built-in loading.tsx convention only.
- After this pass, note which routes now have a loading.tsx and which 
  intentionally don't (e.g. pages with no real async fetch, like 
  src/app/page.tsx which just redirects) so this can be reviewed as a 
  complete checklist, not partial coverage.
- Confirm this doesn't affect the Android APK build path — loading.tsx and 
  Promise.all are both server-side/build-time changes picked up 
  automatically through the existing server.url WebView pointer, no APK 
  rebuild needed; state this explicitly in your summary.
- Provide a before/after note per route touched (which queries were 
  parallelized, whether a loading.tsx was added or already existed) so this 
  can be reviewed as a diff, not just trusted as done.
