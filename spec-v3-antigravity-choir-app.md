# Choir Collective App — v4 Addendum: Super Admin + Email/Password Auth

> Read alongside `spec-v3-antigravity.md` — this file only lists what
> changes or adds on top of v3. Save both to `.agent/rules/` so Antigravity
> has the full picture; don't merge them by hand, the diffs below are
> precise about what replaces what.

---

## 1. `app_role` enum — add `super_admin`

```sql
-- fresh database:
create type app_role as enum ('super_admin', 'director', 'treasurer', 'secretary', 'member', 'pending', 'rejected');

-- already-deployed database (v3 already applied):
alter type app_role add value 'super_admin';
```

## 2. Middleware role table — replaces v3's table

| Role | Allowed admin routes | Redirect if role check fails |
|---|---|---|
| `pending` | none | → `/pending-approval` |
| `rejected` | none | → `/rejected` |
| `super_admin` | all `/admin/*` | — |
| `director` | all `/admin/*` | — |
| `secretary` | `/admin/users`, `/admin/roster`, `/admin/attendance` | → `/dashboard` |
| `treasurer` | `/admin/finances` | → `/dashboard` |
| `member` | none | → `/dashboard` |

No new route needed — Super Admin uses the same `/admin/users` screen as
Director/Secretary, just with a wider set of actions available (see §4).

## 3. RLS — bypass policy, not a rewrite

Rather than editing every existing policy from v3 to add `'super_admin'`
into each role list (error-prone, easy to miss one table), add a single
helper function and one extra permissive policy per table. Postgres
combines multiple permissive policies with `OR`, so this cleanly grants
Super Admin full access everywhere without touching v3's existing SQL:

```sql
create or replace function is_super_admin()
returns boolean language sql stable as $$
  select exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'super_admin');
$$;

create policy "super_admin_bypass_profiles" on profiles for all using (is_super_admin());
create policy "super_admin_bypass_songs" on songs for all using (is_super_admin());
create policy "super_admin_bypass_mass_sequences" on mass_sequences for all using (is_super_admin());
create policy "super_admin_bypass_sequence_items" on sequence_items for all using (is_super_admin());
create policy "super_admin_bypass_practice_tracks" on practice_tracks for all using (is_super_admin());
create policy "super_admin_bypass_live_sessions" on live_sessions for all using (is_super_admin());
create policy "super_admin_bypass_member_dues" on member_dues for all using (is_super_admin());
create policy "super_admin_bypass_join_requests" on join_requests for all using (is_super_admin());

create policy "super_admin_bypass_storage" on storage.objects for all using (is_super_admin());
```

Also add `'super_admin'` to the allowed-editor check inside v3's
`prevent_self_privilege_escalation()` trigger, so a Super Admin editing
their own row isn't blocked the way a Member would be.

## 4. Role-assignment hierarchy — new, closes a real gap

**The gap:** v3's `admin_full_access` policy lets Director *and* Secretary
write any value to `profiles.role`. Nothing stops a Secretary from setting
someone's role to `director` or (once this addendum ships) `super_admin`.
Adding Super Admin as a concept means nothing if any Secretary can mint one.

```sql
create or replace function enforce_role_assignment_hierarchy()
returns trigger as $$
declare
  actor_role app_role;
begin
  if new.role is distinct from old.role then
    select role into actor_role from profiles where id = auth.uid();

    if new.role = 'super_admin' and actor_role is distinct from 'super_admin' then
      raise exception 'Only a Super Admin can assign the Super Admin role';
    end if;

    if new.role = 'director' and actor_role is distinct from 'super_admin' then
      raise exception 'Only a Super Admin can assign the Director role';
    end if;

    if actor_role = 'secretary' and new.role not in ('member', 'rejected', 'pending') then
      raise exception 'Secretary can only approve, reject, or reset pending applicants';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_enforce_role_hierarchy
  before update on profiles
  for each row execute function enforce_role_assignment_hierarchy();
```

Net effect: Secretary keeps exactly the power the org actually wants
(approve/reject signups) and loses the ability to create Directors or
Super Admins. Director can still promote to Secretary/Treasurer/Member.
Only Super Admin can create another Super Admin or a Director.

## 5. Direct user creation ("add users") — Super Admin only

Approving a `pending` applicant (existing v3 flow) is different from what
you asked for here — creating an account *directly*, with a role already
assigned, bypassing signup entirely (e.g. adding a Treasurer who'll never
self-register). This needs the Supabase service-role client, so it must be
a server action / API route, never client-side:

```ts
// /app/admin/users/actions.ts — server action, service-role client only
'use server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function createUserDirectly(input: {
  email: string;
  fullName: string;
  role: 'director' | 'treasurer' | 'secretary' | 'member';
  // 'super_admin' intentionally excluded from this UI action — see note below
}) {
  // 1. verify caller is super_admin (re-check server-side, don't trust the client)
  // 2. supabaseAdmin.auth.admin.createUser({ email, email_confirm: true, ... })
  //    email_confirm: true skips the verification email for admin-created accounts —
  //    the Super Admin is vouching for the address by typing it in themselves.
  // 3. upsert profiles row with the chosen role (the auth trigger already created
  //    a 'pending' row on step 2's insert into auth.users — overwrite its role here)
}
```

**Deliberate restriction:** the direct-creation UI does not offer
`super_admin` as an assignable role, even though the DB trigger in §4 would
allow it. Minting a new Super Admin is rare and higher-stakes than adding a
Treasurer — keep it to a manual SQL statement run by an existing Super
Admin, so there's no one-click path to creating a second super-user by
accident.

## 6. Bootstrap: the first Super Admin

```
# .env
SUPER_ADMIN_BOOTSTRAP_EMAILS=founder@choir.org,it-volunteer@choir.org
```

**Dev bootstrap account:** `scripts/seed-super-admin.ts` (alongside this
file) creates the initial account directly via the Supabase admin API,
useful for local dev / first-run setup without going through the
allowlist-on-signup path at all. Default dev credentials:

```
email:    super_admin@collective.com
password: TestPass123!
```

These are **local-dev-only defaults** — the script reads
`SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` from the environment first and
only falls back to the above when they're unset, and it hard-refuses to use
the fallback password when `NODE_ENV=production`. Before any real
deployment, set both env vars to a real address and a generated password,
and treat the ones above as burned/public from this point on since they now
live in a spec file.

```sql
-- called from the auth.users insert trigger (extends v3 §4's trigger),
-- checked via a Postgres setting synced from the env var at deploy time,
-- OR simplest: check directly in the trigger against a small allowlist table
create table super_admin_bootstrap_allowlist (
  email text primary key
);
-- seeded from SUPER_ADMIN_BOOTSTRAP_EMAILS at deploy (migration script reads
-- the env var and inserts rows) — not hardcoded into the trigger function
-- itself, so rotating the allowlist doesn't require a new migration.
```

```sql
-- extend the existing "new auth.users row -> profiles row" trigger:
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    case
      when exists (select 1 from super_admin_bootstrap_allowlist where email = new.email)
      then 'super_admin'
      else 'pending'
    end
  );
  return new;
end;
$$ language plpgsql security definer;
```

**Important:** once someone's first sign-in consumes the allowlist match,
remove their email from `super_admin_bootstrap_allowlist` (a follow-up
statement in the same trigger, or a nightly cleanup) so a *second* person
who later registers with a *reused* address (e.g. if the org's email
alias changes hands) doesn't silently inherit Super Admin. Simplest: delete
the matched row inside the trigger itself, same transaction.

## 7. Email/password signup + verification

Enabling both Google OAuth and email/password means two different
"already verified" stories to reconcile:

- **Google OAuth:** Google verifies the address before Supabase ever sees
  it — no extra step, `email_confirmed_at` is set automatically.
- **Email/password:** must not be treated as verified until the user clicks
  the confirmation link. In Supabase Dashboard → Authentication → Providers
  → Email, turn **Confirm email** ON. Until confirmed, Supabase refuses to
  issue a session on sign-in (distinct from the `pending` *role* — this is
  a separate, earlier gate).

**Interaction with the approval queue (new — v3 didn't have this problem
since it was OAuth-only):** an email/password user's `profiles` row is
created at signup time (same trigger, same `pending` role), *before* they've
clicked the confirmation link. Director/Secretary shouldn't see or approve
an unconfirmed applicant — approving an email that isn't provably owned by
the applicant defeats the point of verification. Expose the queue through a
function that also carries confirmation status, since `auth.users` isn't
directly queryable by clients under RLS:

```sql
create or replace function admin_list_pending_users()
returns table(profile_id uuid, full_name text, email text, email_confirmed boolean, created_at timestamptz)
language sql security definer as $$
  select p.id, p.full_name, p.email, (u.email_confirmed_at is not null), p.created_at
  from profiles p
  join auth.users u on u.id = p.id
  where p.role = 'pending'
    and exists (select 1 from profiles a where a.id = auth.uid() and a.role in ('director','secretary','super_admin'));
$$;

revoke all on function admin_list_pending_users() from public;
grant execute on function admin_list_pending_users() to authenticated;
```

UI: disable the Approve button (or hide the row entirely) while
`email_confirmed` is `false`; show "awaiting email confirmation" instead.

---

## 8. Resolved Decisions Log (extends v3 §8)

| # | Question | Resolution |
|---|---|---|
| 6 | Auth methods | Google OAuth + email/password, both supported. |
| 7 | First Super Admin | Env-var (`SUPER_ADMIN_BOOTSTRAP_EMAILS`) → allowlist table → auto-promoted on first sign-in, allowlist row consumed/deleted on match. |
| 8 | Can Secretary create a Director or Super Admin? | No — enforced by `enforce_role_assignment_hierarchy` trigger, not left to RLS alone. |
| 9 | Can the "add user directly" UI mint a Super Admin? | No, deliberately excluded from that form even though the DB would technically permit it — requires a manual SQL statement instead. |

---

## 9. Migration Order (extends v3 §9)

Apply *after* v3's steps 1–10:

11. `alter type app_role add value 'super_admin'` (or include in the enum from the start on a fresh DB)
12. `is_super_admin()` function + all `super_admin_bypass_*` policies
13. `enforce_role_assignment_hierarchy` trigger; extend `prevent_self_privilege_escalation` to allow `super_admin`
14. `super_admin_bootstrap_allowlist` table, seeded from `SUPER_ADMIN_BOOTSTRAP_EMAILS`
15. Update `handle_new_user()` trigger for allowlist check + row consumption
16. Enable email/password provider + "Confirm email" in Supabase Auth settings
17. `admin_list_pending_users()` function
18. Server action for direct user creation (`/admin/users` UI addition)
