# CHOIR APP — FINANCE FEATURES
## Antigravity / Gemini Implementation & Audit Prompt
### Sinking Fund + Solicitations

> **Repository:** `DevMon18/choir-app`
> **Branch:** `main`
> **Mode:** Audit first → propose → STOP → wait for approval → implement

## 0. NON-NEGOTIABLE EXECUTION MODE

You are modifying a real choir-management application with financial records. Treat this feature as **financially sensitive**.

Follow exactly:

```text
REPOSITORY AUDIT
        ↓
LIVE SUPABASE AUDIT
        ↓
CURRENT-STATE REPORT
        ↓
CONFLICT / RISK ANALYSIS
        ↓
ARCHITECTURE PROPOSAL
        ↓
MIGRATION SQL PROPOSAL
        ↓
FILE-BY-FILE PLAN
        ↓
STOP
        ↓
WAIT FOR EXPLICIT USER APPROVAL
        ↓
IMPLEMENT
        ↓
TEST
        ↓
SECURITY REVIEW
        ↓
FINAL VERIFICATION
```

During the audit phase, **DO NOT** create/alter/drop tables, change RLS, modify migrations or application code, insert seed data, deploy, or silently migrate existing finance data.

---

# 1. CURRENT REPOSITORY CONTEXT

The current public repository is `DevMon18/choir-app`.

The current project uses:

- Next.js 16
- React 19
- TypeScript
- Supabase JS / SSR
- Capacitor Android
- Capacitor Push Notifications
- Capacitor Local Notifications
- SWR
- Upstash Redis / Ratelimit
- Tailwind CSS
- PDF-Lib
- web-push

Important existing infrastructure includes:

```text
src/lib/audit.ts
src/lib/push.ts
src/lib/dateUtils.ts
src/lib/cache.ts
src/lib/pdf-generator.ts
src/lib/pdf-stamper.ts
src/lib/supabase/*
supabase/migrations/*
```

The repository already contains a legacy `member_dues` table. Its original migration defines approximately:

```text
id uuid
user_id uuid
amount numeric(10,2)
due_date date
status text
created_at timestamptz
```

The repository's role enum includes:

```text
super_admin
director
treasurer
secretary
member
pending
rejected
```

The application already standardizes business time to:

```text
Asia/Manila
```

through `src/lib/dateUtils.ts`.

The existing application also has an audit helper and targeted push helper. **Reuse these patterns rather than creating parallel systems.**

---

# 2. FIRST: AUDIT THE ACTUAL REPOSITORY

Do not assume the context above is still completely accurate. Inspect the current `main` branch and the live Supabase database.

Inspect:

- existing finance UI
- existing dues UI
- existing server actions
- existing Supabase clients
- existing RLS helpers
- existing role checks
- existing offline/cache implementation
- existing cron/scheduled jobs
- existing exports
- existing notification scheduling
- existing audit logging
- existing settings/configuration tables
- existing member/active/inactive/waiver model

Use actual file paths from the repository. Do not invent paths.

---

# 3. STEP 1 — LIVE DATABASE AUDIT

Using the connected Supabase MCP/tool, inspect the **live** database.

## 3.1 `member_dues`

Report exact:

- columns
- types
- defaults
- nullable state
- primary key
- foreign keys
- indexes
- constraints
- triggers
- functions
- RLS enabled state
- RLS policies
- production-data implications

## 3.2 Existing finance structures

Search for:

```text
dues
payment
payments
finance
fund
fundraising
solicitation
contribution
donation
collection
transaction
ledger
```

Inspect tables, views, functions, RPCs, triggers, policies, and indexes.

## 3.3 Scheduled infrastructure

Inspect repository and live database for:

```text
pg_cron
cron
scheduled
cron_logs
birthday_privacy
```

Determine whether the project actually uses:

- Supabase pg_cron
- Edge Functions
- Vercel Cron
- GitHub Actions
- another scheduler

Do not assume the scheduler.

## 3.4 Timezone

Confirm the application's `Asia/Manila` business timezone and database timezone behavior.

The monthly rollover must not accidentally execute at the wrong Philippine calendar boundary because of UTC.

---

# 4. STEP 2 — SINKING FUND

Goal:

```text
₱40/month target by default
```

Members may pay weekly after Mass:

```text
₱5
₱10
₱20
Custom
```

The system must support rolling shortfall/credit.

---

# 5. `dues_periods`

Propose a table conceptually containing:

```text
id uuid PRIMARY KEY
member_id uuid REFERENCES profiles(id)
period_label text
base_amount_centavos integer
carried_balance_centavos integer
amount_due_centavos integer
is_exempt boolean
created_at timestamptz
```

Required:

```text
UNIQUE(member_id, period_label)
```

The row represents the **monthly target**, not individual payments.

Do not store payment totals in this table.

### Important

Do not blindly make `amount_due_centavos` a PostgreSQL generated column. First verify whether the chosen formula and migration strategy support that cleanly. A stored value or view may be safer.

Explain the choice before implementation.

---

# 6. CONFIGURABLE ₱40 TARGET

The default must be:

```text
4000 centavos
```

but it MUST NOT be hardcoded throughout the application.

Inspect whether an organization settings/configuration table already exists.

If it exists, reuse it.

If it does not, propose the smallest appropriate settings mechanism.

Do not create a huge generic settings framework just for this feature.

---

# 7. `dues_payments` — APPEND-ONLY LEDGER

Create conceptually:

```text
id uuid PRIMARY KEY
dues_period_id uuid REFERENCES dues_periods(id)
amount_centavos integer NOT NULL
method text NOT NULL
reference text NULL
recorded_by uuid REFERENCES profiles(id)
paid_at timestamptz DEFAULT now()
voided_at timestamptz NULL
voided_reason text NULL
```

Methods:

```text
cash
gcash
bank_transfer
other
```

Rules:

- amount must be positive
- payment rows are never deleted
- payment amounts are never overwritten
- corrections use `voided_at` + `voided_reason` and a new payment row
- current paid total is always derived from valid ledger rows

Derived amount:

```sql
SUM(amount_centavos)
WHERE dues_period_id = X
AND voided_at IS NULL
```

Do not create `amount_paid` as mutable stored state.

---

# 8. LEDGER INTEGRITY

Evaluate database constraints such as:

```text
amount_centavos > 0
```

and:

```text
voided_at IS NULL
OR trim(voided_reason) <> ''
```

Only authorized finance roles may void records.

Members must never be able to alter or void ledger rows.

---

# 9. FINANCE ROLE POLICY

The requested requirement mentions:

```text
director
secretary
treasurer
super_admin
```

However, the existing repository's legacy `member_dues` policy treats:

```text
director
treasurer
super_admin
```

as finance-capable.

Therefore do not silently broaden permissions.

Audit the current role convention and flag this as a business decision.

Recommended default:

```text
treasurer + director + super_admin
```

Secretary should only be included if explicitly approved.

---

# 10. SERVER-SIDE AUTHORIZATION

Never trust the client for:

```text
recorded_by
amount_centavos
member_id
dues_period_id
voided_at
voided_reason
```

Derive authenticated user identity server-side.

Verify role server-side.

Do not rely on hidden buttons or client route guards for financial security.

---

# 11. DERIVED DUES SUMMARY

Consider a view/RPC/server query that returns:

```text
base_amount
carry
amount_due
amount_paid
remaining_balance
percentage
```

All payment totals must be derived.

Do not create a mutable running total.

---

# 12. MONTHLY ROLLOVER

At the start of every new month:

1. Identify active, non-exempt members.
2. Check whether the new `period_label` already exists.
3. If it exists, skip it.
4. Read the previous period.
5. Derive previous `amount_paid` from non-voided ledger rows.
6. Calculate the carry.
7. Create the new period.

The unique constraint must protect against duplicate periods.

The job must be safe to run repeatedly.

---

# 13. OVERPAYMENT — MUST BE CONFIRMED

Default proposal:

```text
YES — overpayment becomes negative carry-forward credit.
```

Example:

```text
June due = ₱40
Paid = ₱50
Carry = -₱10
July due = ₱30
```

**Do not implement this business rule until the user confirms it.**

The audit report must explicitly ask:

> Should overpayment create a negative carry-forward credit?
>
> Recommended: YES.

---

# 14. CREDIT EXCEEDING NEXT MONTH'S TARGET

Another ambiguity must be resolved.

Example:

```text
June due = ₱40
Paid = ₱100
Credit = ₱60
```

Recommended behavior:

```text
July due = ₱0
remaining ₱20 credit carries forward
```

Do NOT allow a negative amount due unless explicitly approved.

The implementation plan must ask the user to confirm this.

---

# 15. NEW MEMBERS

Inspect the actual membership/join-date model.

Do not backdate dues before the member actually joined.

If no reliable join-date exists, report this as a blocking dependency.

Do not automatically assume `profiles.created_at` is the business join date unless the repository already treats it that way.

---

# 16. EXEMPT MEMBERS

Inspect existing waiver/exemption functionality, including:

```text
src/lib/waiver-types.ts
```

Reuse existing concepts where appropriate.

Exempt members:

- receive no new dues period
- receive no base charge
- receive no carry
- retain historical financial records

Do not invent a duplicate exemption system.

---

# 17. SOLICITATIONS

Create a structurally separate fundraising feature.

Conceptually:

```text
solicitations
```

with:

```text
id uuid PRIMARY KEY
title text NOT NULL
description text
 target_amount_centavos integer NULL
start_date date NOT NULL
end_date date NULL
status text NOT NULL
created_by uuid REFERENCES profiles(id)
created_at timestamptz DEFAULT now()
```

Status:

```text
active
closed
```

Target is optional.

If supplied, it must be positive.

---

# 18. `solicitation_contributions`

Append-only ledger:

```text
id uuid PRIMARY KEY
solicitation_id uuid REFERENCES solicitations(id)
contributor_type text NOT NULL
member_id uuid NULL REFERENCES profiles(id)
contributor_name text NULL
amount_centavos integer NOT NULL
method text NOT NULL
reference text NULL
recorded_by uuid REFERENCES profiles(id)
contributed_at timestamptz DEFAULT now()
voided_at timestamptz NULL
voided_reason text NULL
```

Constraint:

```text
contributor_type IN ('member','external')
```

For member:

```text
member_id IS NOT NULL
```

For external:

```text
member_id IS NULL
contributor_name IS NOT NULL
```

Never allow an invalid mixed state.

---

# 19. EXTERNAL DONOR PRIVACY — MUST BE CONFIRMED

The public solicitation feed can show recent contributors, but external donor names may be private.

Recommended default:

```text
Member: Maria S. contributed ₱200
External: External donor contributed ₱200
```

Treasurer/admin can see the actual external donor identity.

Ask the user:

> Should external donor names be publicly visible in the solicitation contributor feed?
>
> Recommended: NO.

Do not implement public external donor names without confirmation.

---

# 20. SOLICITATION TOTALS

Derived only:

```sql
SUM(amount_centavos)
WHERE solicitation_id = X
AND voided_at IS NULL
```

Never store a mutable:

```text
current_total
amount_raised
total_collected
```

field as the source of truth.

---

# 21. SUNDAY COLLECTION MODE

Build for a treasurer using a phone immediately after Mass.

Prioritize speed.

Example:

```text
Sunday Collection

Collected
₱340

17 / 25 members

Search members...

Maria
[ ₱5 ] [ ₱10 ] [ ₱20 ] [ Custom ]

Juan
[ ₱5 ] [ ₱10 ] [ ₱20 ] [ Custom ]
```

Use large touch targets and minimal typing.

Default method:

```text
cash
```

Allow:

```text
GCash
Bank Transfer
Other
```

---

# 22. RUNNING COLLECTION TOTAL

Always show:

```text
₱340 collected
17 of 25 members
```

Clearly distinguish:

```text
members recorded
```

from:

```text
members fully paid
```

Do not use misleading completion percentages.

---

# 23. OFFLINE-FIRST COLLECTION

The repository already contains cache infrastructure:

```text
src/lib/cache.ts
```

and is a Capacitor Android application.

Inspect the existing implementation before introducing IndexedDB, SQLite, or another storage library.

Reuse existing infrastructure if suitable.

Sunday Collection must continue functioning when network connectivity is unavailable.

---

# 24. OFFLINE PAYMENT QUEUE

A queued operation should contain enough information to retry safely, conceptually:

```text
local_operation_id
member_id
dues_period_id
amount_centavos
method
reference
client_created_at
sync_status
```

Suggested statuses:

```text
pending
syncing
synced
failed
conflict
```

The server remains authoritative.

Never tell the user that a payment was permanently recorded merely because it was saved locally.

---

# 25. OFFLINE IDEMPOTENCY

This is mandatory.

Scenario:

```text
Treasurer records ₱10
network fails
app retries
network returns
```

The server must not create two ₱10 payments.

Use an idempotency key such as:

```text
client_operation_id
```

and enforce the protection at the database/server level.

Do not rely only on React state or a disabled button.

---

# 26. OFFLINE CONFLICTS

Handle:

- app restart while entries are pending
- member becomes inactive
- member becomes exempt
- period changes while device is offline
- same operation is retried
- server already accepted the operation
- sync fails repeatedly

Failed financial operations must remain visible to the treasurer.

Provide:

```text
Sync failed
Retry
View details
```

Do not silently discard entries.

---

# 27. COLLECTION CLOSE-OUT

If a manual batch total is entered, compare it with the sum of individual entries.

Example:

```text
Entries = ₱340
Declared total = ₱350
Difference = ₱10
```

Block close-out until resolved.

Show a clear discrepancy message.

Do not silently accept mismatches.

If the existing application has a collection-session concept, reuse it. Otherwise propose a minimal session model only if necessary.

---

# 28. SOLICITATION CONTRIBUTION FLOW

Example:

```text
Log Contribution

Solicitation
[ Choir Uniform Fund ▼ ]

Contributor
[ Search member... ]

OR
[ External Donor ]

Amount
₱____

Method
Cash / GCash / Bank / Other

Reference
(optional)

[ Save Contribution ]
```

If only one active solicitation exists, auto-select it.

---

# 29. MEMBER DUES UI

Current month should show:

```text
June Sinking Fund

₱25 / ₱40

[████████░░]

₱40 base
+ ₱5 carried from May
= ₱45 target

₱20 remaining
```

Make debt/current due visually distinct from contribution history.

---

# 30. TOTAL CONTRIBUTED

Show separately:

```text
Total Sinking Fund
₱480
```

This means:

```text
SUM(valid dues payments)
```

It is NOT a debt figure.

Also show solicitation giving separately:

```text
Total Sinking Fund: ₱480
Total Solicitation Given: ₱650
```

Never merge the categories.

---

# 31. WEEKLY REMINDER

The real-world collection cadence is weekly.

Use the existing notification infrastructure and push helper.

Preferred reminder window:

```text
Saturday evening
OR
Sunday morning
```

Inspect the actual scheduler before implementing.

The current push infrastructure includes a targeted `sendPushToUser(userId, payload)` pattern. Reuse it.

Financial writes must not depend on successful notification delivery.

---

# 32. PUBLIC SOLICITATION PROGRESS

Example:

```text
Choir Uniform Fund

₱12,500 raised
₱20,000 goal

[████████░░░░░]

62.5%
```

Recent contributors may be displayed with privacy rules applied.

If target is null, do not show a fake percentage.

---

# 33. ROLE / RLS RULES

Members may:

```text
SELECT their own dues periods
SELECT their own dues payments
SELECT public solicitation information
SELECT their own contribution history
```

Members may NOT:

```text
INSERT finance ledger rows
UPDATE finance ledger rows
DELETE finance ledger rows
VOID finance ledger rows
```

Finance mutations must be server-authorized.

Evaluate:

```text
treasurer
director
super_admin
```

and explicitly resolve secretary permissions before implementation.

---

# 34. VOID WORKFLOW

Authorized officer flow:

```text
Payment
₱100 cash

[Void Payment]

Reason:
Incorrect amount entered

[Confirm Void]
```

Server performs:

```text
voided_at = now()
voided_reason = reason
```

Do not modify the original amount.

A corrected payment is a new ledger row.

---

# 35. AUDIT LOGGING

Reuse:

```text
src/lib/audit.ts
```

The existing helper writes audit rows using:

```text
actor_id
actor_email
action
entity_type
entity_id
metadata
```

At minimum audit:

```text
dues_payment_created
dues_payment_voided
solicitation_created
solicitation_updated
solicitation_closed
solicitation_contribution_created
solicitation_contribution_voided
dues_period_created
dues_rollover_executed
```

Use existing naming conventions if the live database already establishes another convention.

---

# 36. REPORTING / EXPORT

The repository already contains PDF infrastructure:

```text
src/lib/pdf-generator.ts
src/lib/pdf-stamper.ts
```

and uses PDF-Lib.

Reuse existing export patterns.

Do not introduce another PDF library unnecessarily.

Treasurer reports must support:

```text
dues_payments
solicitation_contributions
```

with date-range filtering.

CSV and PDF must clearly distinguish valid and voided rows.

---

# 37. REPORT SECURITY

Full financial reports are sensitive.

Only authorized finance roles should generate them.

Do not create a public export endpoint.

Server-side authorization is mandatory.

---

# 38. PERFORMANCE

Do not download all historical payments to the browser.

Use database aggregation.

Evaluate, based on actual queries, indexes such as:

```text
dues_periods(member_id, period_label)
dues_payments(dues_period_id)
dues_payments(paid_at)
dues_payments(recorded_by)
solicitation_contributions(solicitation_id)
solicitation_contributions(contributed_at)
solicitation_contributions(member_id)
```

Do not create indexes blindly.

---

# 39. MONEY FORMATTER

Create/reuse one central money formatter.

Conceptually:

```text
formatPHPFromCentavos(4000)
→ ₱40.00
```

Do not scatter `/ 100` across the application.

Internally use integer centavos.

---

# 40. TYPE SAFETY

Use explicit finance types.

Examples:

```text
MoneyCentavos
DuesPeriod
DuesPayment
Solicitation
SolicitationContribution
```

Do not use `any` for finance records.

Use the project's existing validation conventions.

---

# 41. DATABASE TRANSACTION SAFETY

Important financial operations must be atomic.

Do not implement multi-step money operations as independent browser requests where partial failure can corrupt state.

Rollover, idempotent payment insertion, and voiding should have clear transaction boundaries.

---

# 42. ROLLOVER EDGE CASES

Test:

```text
₱40 due / ₱0 paid → +₱40 carry
₱40 due / ₱20 paid → +₱20 carry
₱40 due / ₱40 paid → ₱0 carry
₱40 due / ₱50 paid → -₱10 carry if approved
```

Also test credit larger than the next monthly target.

Do not allow a negative `amount_due` unless explicitly approved.

---

# 43. MEMBER STATUS CHANGES

Test:

```text
active → inactive
active → exempt
exempt → active
```

Do not delete historical records.

Future generation should follow the actual membership status rules.

---

# 44. SOLICITATION LIFECYCLE

Recommended:

```text
create → active → closed
```

Determine how `end_date` interacts with `status`.

Do not silently invent an auto-close rule if the existing product has another convention.

Prevent ordinary contributions after closure unless reopening is explicitly supported.

---

# 45. REFERENCE NUMBERS

For:

```text
GCash
Bank Transfer
```

support a reference field.

Do not expose sensitive payment references in public contributor feeds.

---

# 46. NAVIGATION

Inspect the actual navigation.

Do not build a separate mini finance application.

A possible structure is:

```text
Finance
 ├── My Dues
 ├── Solicitations
 └── Finance Admin
      ├── Sunday Collection
      ├── Dues
      ├── Solicitations
      └── Reports
```

Only expose admin routes to authorized roles.

Use the application's existing layout/navigation patterns.

---

# 47. LEGACY `member_dues` MIGRATION

This is one of the most important audit tasks.

Determine whether existing `member_dues` is:

- actively used by UI
- queried by server actions
- populated in production
- referenced by reports
- referenced by RLS/functions
- safe to deprecate

Possible strategies:

```text
A. Keep legacy table temporarily
B. Migrate historical obligations/payments
C. Deprecate after application migration
```

Do not drop it immediately.

If existing `amount numeric(10,2)` values represent payments rather than obligations, explicitly map them to the new append-only ledger before changing behavior.

Never assume the semantic meaning of legacy rows.

---

# 48. LIVE DATABASE VS MIGRATION HISTORY

Repository migrations are not proof that the live database matches them.

Compare:

```text
repository migration state
VS
live Supabase state
```

Report differences.

Never silently assume the latest migration is deployed.

---

# 49. SECURITY AUDIT

While inspecting the repository, check finance-adjacent server code and secrets handling.

The existing push implementation contains VAPID configuration logic. Do not copy credentials, private keys, tokens, or secrets into new files, client code, logs, prompts, or database records.

If hard-coded secrets are found, flag them as a security issue and recommend environment-secret storage and credential rotation. Do not reproduce secrets in your report.

---

# 50. REQUIRED AUDIT REPORT FORMAT

Before changing anything, return exactly these sections:

## A. Repository Snapshot

```text
Repository
Branch
Latest commit
Framework
Supabase
Capacitor
```

## B. Existing Finance Schema

```text
member_dues
other finance tables
views/functions/triggers
```

## C. Existing Roles

Explain the actual role model.

## D. Existing RLS

Explain relevant policies and helper functions.

## E. Existing Timezone / Date Infrastructure

Explain `Asia/Manila` handling.

## F. Existing Cron / Scheduling Infrastructure

Identify the actual mechanism.

## G. Existing Offline / Cache Infrastructure

Explain what can be reused for Sunday Collection.

## H. Existing Push Infrastructure

Explain `sendPushToUser` and scheduling patterns.

## I. Existing Audit Infrastructure

Explain `recordAuditLog` and existing audit table conventions.

## J. Existing PDF / Export Infrastructure

Identify actual reusable paths.

## K. Existing Finance UI

List actual paths.

## L. Conflicts

List all conflicts between the requested design and current application.

## M. Financial Risks

At minimum:

- duplicate payments
- offline retries
- race conditions
- voiding
- legacy data
- signed carry
- negative due
- role authorization
- donor privacy
- timezone
- cron idempotency
- report integrity

## N. Recommended Architecture

Give the final proposed architecture based on the actual repository.

## O. Exact Migration SQL

Show SQL only. **Do not execute it.**

## P. Exact File-by-File Plan

Use actual repository paths.

For each:

```text
PATH
CREATE / MODIFY
PURPOSE
SECURITY IMPACT
PERFORMANCE IMPACT
```

## Q. Required Business Confirmations

Explicitly ask:

1. Should overpayment create negative carry-forward credit? Recommended YES.
2. If credit exceeds next month's target, should due become ₱0 and remaining credit continue forward? Recommended YES.
3. Should secretary have finance mutation/void permissions? Recommended NO unless approved.
4. Should external donor names be public? Recommended NO.
5. Is direct member self-payment required now? Recommended NO for V1 unless explicitly requested.

---

# 51. IMPLEMENTATION GATE

After the audit and proposal, STOP.

Do not create or modify:

```text
migration
RLS
server actions
components
hooks
finance UI
cron
reports
```

until the user explicitly approves the architecture and resolves the business confirmations.

End the audit with exactly:

```text
FINANCE FEATURE AUDIT COMPLETE.

I have inspected the current repository and live database patterns.

No database or application changes have been applied.

The following business decisions require confirmation:
1. Overpayment credit behavior
2. Credit exceeding next month's target
3. Secretary finance permissions
4. External donor name visibility
5. Whether member self-payment is required now

WAITING FOR USER APPROVAL.
```

---

# 52. FINAL ENGINEERING PRINCIPLES

For this feature:

```text
correctness > convenience

auditability > shortcuts

database integrity > UI assumptions

idempotency > optimistic retries

append-only history > mutable totals

server authorization > hidden buttons

offline durability > temporary local state

explicit business rules > guessed behavior
```

This feature handles real money. Never sacrifice financial integrity for implementation speed.
