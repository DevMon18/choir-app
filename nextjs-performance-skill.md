# Next.js Performance Optimization — Skill Reference

> Read this before writing or reviewing any Next.js code — pages, layouts, 
> server actions, or data fetching. This is a standing reference, not a 
> one-time task. Save under `.agent/rules/` alongside the other project 
> rules. Where a technique below is already partially applied in this 
> codebase, extend that existing pattern rather than introducing a 
> different one.

This project runs Next.js 16 (App Router) on Vercel, backed by Supabase, 
and is also wrapped as a Capacitor Android APK that loads the deployed 
site in a WebView. Every technique below should be evaluated against 
both the web deployment and that WebView context.

---

## 1. Server Components by default — Client Components only when needed

Next.js App Router components are Server Components unless marked 
`'use client'`. Server Components:
- Don't ship their JS to the browser (smaller bundle)
- Can fetch data directly (no client-side loading spinner needed for 
  initial render)
- Can't use hooks, browser APIs, or event handlers

**Rule:** only add `'use client'` when a component genuinely needs 
interactivity (`useState`, `onClick`, `useEffect`, browser APIs) or a 
library that requires it (GSAP animations, Supabase browser client). 
Push `'use client'` as far down the tree as possible — a whole page 
shouldn't be a Client Component just because one button inside it needs 
`onClick`.

This codebase already does this reasonably well (e.g. `page.tsx` files 
are Server Components that fetch data and pass it to a `*Client.tsx` 
component). Keep following that split when adding new routes: 
`page.tsx` = Server Component doing the fetch, `XClient.tsx` = Client 
Component doing the interactivity, exactly like 
`src/app/dashboard/page.tsx` → `DashboardClient.tsx`.

---

## 2. Parallelize independent data fetches — never sequential `await`s for unrelated queries

Already flagged and being fixed in this codebase 
(`getCalendarEvents()` in `src/app/calendar/actions.ts`, and the 
broader audit across `admin/analytics`, `admin/sequences`, 
`admin/finances`). The rule going forward:

```js
// WRONG — pays three round-trips back to back
const a = await supabase.from('table_a').select();
const b = await supabase.from('table_b').select();
const c = await supabase.from('table_c').select();

// RIGHT — pays one round-trip, all three resolve concurrently
const [a, b, c] = await Promise.all([
  supabase.from('table_a').select(),
  supabase.from('table_b').select(),
  supabase.from('table_c').select(),
]);
```

Only keep fetches sequential when a later one genuinely depends on an 
earlier one's result (e.g. `src/app/live/page.tsx` fetching the active 
song only after knowing the active session's `active_song_id` — that 
dependency is real and must stay sequential).

---

## 3. Stream slow data with `loading.tsx` + Suspense — don't block the whole page on the slowest query

Already being wired into this codebase (skeleton components in 
`src/components/skeletons/*` + `loading.tsx` files per route). Beyond 
that baseline: if a single page has one slow section and several fast 
ones (e.g. a dashboard with a fast profile card and a slow analytics 
chart), wrap just the slow part in `<Suspense fallback={<Skeleton />}>` 
around an `async` child Server Component, rather than making the whole 
page wait on the slowest query. This lets fast content paint immediately 
while the slow section streams in after.

---

## 4. Cache read-heavy, rarely-changing data with `unstable_cache` or route-level `revalidate`

Most of this app's data (announcements, songs, sequences) changes 
occasionally (an admin edits it) but is read constantly (every member 
loads it). Two tools, use the right one per case:

- **`export const revalidate = <seconds>`** in a `page.tsx` — good for 
  data that's fine being slightly stale (e.g. the public Repertoire list 
  could tolerate a 60s cache even though it's not currently cached at 
  all — `src/app/repertoire/page.tsx` currently sets 
  `dynamic = 'force-dynamic'`, meaning it re-fetches on every request 
  with zero caching, which is the safest default but leaves an easy win 
  on the table for genuinely public, admin-edited-rarely content).
- **`unstable_cache(fn, keyParts, { revalidate, tags })`** — good for 
  wrapping a specific expensive query function (like the aggregation 
  logic in `admin/analytics/page.tsx`) so it's computed once and reused 
  across requests within the revalidate window, instead of recomputed 
  from scratch on every admin page load.

**Rule when introducing caching:** always pair it with 
`revalidatePath()` or `revalidateTag()` calls in the relevant server 
action, so an admin's edit is reflected immediately rather than waiting 
out a stale cache window. This codebase already calls `revalidatePath` 
consistently in its server actions (see `src/app/admin/songs/actions.ts`, 
`src/app/admin/sequences/actions.ts`) — if you add route-level caching 
to a page, confirm every action that mutates that page's data also 
revalidates it.

**Do not** cache anything that's per-user, permission-sensitive, or 
realtime (dashboard announcements tied to role, live session state, 
directory contact info respecting privacy toggles) — caching those 
risks serving one user's data to another, or showing stale realtime 
state. Cache the genuinely shared, slowly-changing stuff only.

---

## 5. Use `next/image`, not raw `<img>`, for anything that isn't tiny/decorative

Several components in this codebase currently use plain `<img>` tags 
with an eslint-disable comment 
(`DirectoryClient.tsx`'s avatar, `ProfileClient.tsx`'s avatar preview, 
`FinancesClient.tsx`'s member avatars, `Navbar.tsx`'s logo). This means 
these images ship at their original file size/format with no lazy 
loading, no automatic `srcset`, and no format conversion (WebP/AVIF) — 
all of which `next/image` handles automatically.

**Rule going forward:** any new image (profile photos, the Phase 3 
personal photo gallery, event photos) should use `next/image` instead 
of `<img>`. This requires:
1. Adding the Supabase Storage domain to 
   `images.remotePatterns` in `next.config.ts` (currently empty of any 
   image config) — without this, `next/image` will refuse to optimize 
   external Storage URLs.
2. Providing explicit `width`/`height` (or `fill` inside a positioned 
   container) to avoid layout shift.
3. Using `sizes` appropriately for responsive grids (e.g. the photo 
   gallery's 3-column mobile grid).

Existing `<img>` usages don't need an urgent rewrite, but flag them as a 
known gap — the photo-heavy features (profile gallery) being built next 
are exactly where this matters most, since that's real user-uploaded 
image volume, not a small fixed logo.

---

## 6. Font loading — already correct, keep doing this

`src/app/layout.tsx` already uses `next/font/google` (`Geist`, 
`Geist_Mono`) correctly — this self-hosts fonts at build time, avoiding 
a render-blocking external font request. `globals.css`'s `Outfit` import 
via a raw `@import url(...)` from Google Fonts CDN is the one 
inconsistency — that's a render-blocking external request that 
`next/font` would eliminate. Worth migrating `Outfit` to 
`next/font/google` the same way `Geist` already is, for one less 
external network dependency on every page load.

---

## 7. Dynamic imports for heavy/rarely-used client components

Already used in this codebase (`next/dynamic` in 
`src/app/dashboard/page.tsx`, `directory/page.tsx`, 
`admin/announcements/page.tsx`, `calendar/page.tsx`). Keep applying this 
pattern for any new heavy client-only component, especially:
- GSAP-animated client components (GSAP itself adds bundle weight; no 
  need to ship it for a route that doesn't animate)
- Anything only shown conditionally/rarely (a modal, a rarely-opened 
  settings panel)

Don't dynamic-import small, always-visible components — the overhead of 
an extra chunk request isn't worth it for something tiny and always 
rendered.

---

## 8. Middleware cost — understand the tradeoff, don't blindly optimize it away

`src/proxy.ts` calls `supabase.auth.getUser()` on nearly every request, 
which makes a real network round-trip to Supabase Auth to revalidate the 
session token. This is measurable overhead (visible in dev logs as the 
`proxy.ts: XXXms` timing) but it's also the **correct, secure** way to 
do middleware auth checks — `getUser()` actually revalidates the token 
server-side, unlike trusting a possibly-stale/revoked local JWT via 
`getSession()`.

**Rule:** don't "optimize" this by switching to trusting local JWT 
claims without deliberately accepting the tradeoff (a just-revoked or 
just-demoted user could act with stale permissions until token expiry). 
If this cost ever becomes a real problem at higher traffic, that's a 
decision to make explicitly and document, not a default optimization to 
apply quietly.

---

## 9. Route segment config — set explicitly, don't leave it implicit

Every page in this app currently sets `export const dynamic = 
'force-dynamic'`, which disables all caching/static generation for that 
route — always fetch fresh on every request. This is the safe default 
for personalized/role-gated content (which is most of this app), but 
means truly public, rarely-changing content (parts of Repertoire, 
public-facing marketing-style pages if any exist later) pays a full 
re-fetch every time for no reason.

**Rule:** when adding a new route, deliberately choose 
`force-dynamic` (personalized/frequently-changing data), or a `revalidate` 
interval (public, infrequently-changing data), rather than copy-pasting 
`force-dynamic` everywhere by default without considering whether the 
route actually needs it.

---

## 10. Bundle size — audit before adding new dependencies

Before adding a new npm package for a feature (e.g. a chat UI library 
for Direct Messages, a lightbox library for the photo gallery), check:
1. Does an existing dependency already solve this (GSAP for animation, 
   Supabase client for realtime)?
2. Is there a much smaller alternative, or can it be built directly with 
   existing primitives, given this app's scale doesn't need a 
   heavyweight general-purpose library?
3. If added, is it dynamically imported so it doesn't bloat the initial 
   bundle for routes that don't use it?

---

## 11. Capacitor/WebView-specific consideration

Every technique above applies the same way inside the Capacitor APK's 
WebView, since it's loading the same deployed Next.js site 
(`capacitor.config.ts`'s `server.url`). The one APK-specific note: 
`next/image`'s optimization pipeline runs server-side (Vercel's image 
optimization API) — confirm this still resolves correctly from within 
the WebView's network context (it will, since it's just an HTTPS 
request to the same deployed domain, but worth a quick real-device check 
whenever image handling changes, per this app's existing Capacitor-parity 
rule).

---

## 12. Pre-ship checklist for any new route or data-heavy feature

1. Are all independent data fetches in this route running via 
   `Promise.all`, not sequential `await`s?
2. Does this route have a `loading.tsx` using an existing or matching 
   new skeleton component?
3. Is this route's `dynamic`/`revalidate` config a deliberate choice, 
   not a copy-pasted default?
4. Are new images using `next/image` with the Storage domain registered 
   in `next.config.ts`, not a raw `<img>` tag?
5. Is any new heavy client-only component dynamically imported?
6. Would caching this data risk leaking one user's permission-scoped 
   view to another? If yes, don't cache it.
