# Lyrics Contribution & Leaderboard — Implementation Specification

## 1. Purpose

Build a **Lyrics Contribution & Leaderboard** feature for the Choir App.

Members can submit lyrics for specific Mass Parts of existing songs. Director/Super Admin reviews submissions. Approved contributions receive points based on the Mass Part. Approved points feed a leaderboard.

**Critical rule:** inspect the existing codebase and live Supabase database first. Do not create, alter, seed, delete, or modify anything during the audit phase.

---

# 2. IMPLEMENTATION GATE

Follow this exact sequence:

```text
READ-ONLY AUDIT
      ↓
REPORT CURRENT STATE
      ↓
IDENTIFY CONFLICTS / RISKS
      ↓
PROPOSE ARCHITECTURE
      ↓
PROPOSE MIGRATION SQL
      ↓
PROPOSE FILE CHANGES
      ↓
STOP AND WAIT FOR USER APPROVAL
      ↓
IMPLEMENT
      ↓
TEST
      ↓
FINAL REVIEW
```

During the audit phase, do NOT:

- CREATE/ALTER/DROP tables
- INSERT/UPDATE/DELETE data
- change RLS
- modify application code
- deploy anything

---

# 3. STEP 1 — READ-ONLY CURRENT-STATE AUDIT

Using the connected Supabase MCP/tool and repository, inspect:

## 3.1 `songs`

Report exact:

- columns/types
- primary key
- foreign keys
- nullable/default fields
- indexes
- constraints
- RLS policies
- existing lyrics fields
- existing category/Mass Part fields

Especially investigate whether fields such as `category`, `mass_part`, `mass_parts`, or equivalent already exist.

**Do not duplicate existing functionality.**

## 3.2 Existing tables

Check whether these already exist:

- `song_submissions`
- `mass_part_points`
- `leaderboard_points`

If found, report exact columns, constraints, indexes, foreign keys, triggers, views/functions, and RLS.

## 3.3 Notifications

Inspect `push.ts` and existing usages in Tasks, Announcements, or other server actions.

Report:

- function signature
- calling pattern
- auth requirements
- server/client restrictions
- error handling

Reuse the existing notification system. Do not create another one.

## 3.4 Audit logging

Inspect `audit.ts` and existing audit usage.

Report:

- audit table schema
- helper/function signature
- event naming convention
- metadata pattern
- actor handling

Reuse the existing audit system.

## 3.5 Roles

Inspect the actual role implementation.

Default reviewer roles:

```text
director
super_admin
```

Do not automatically grant approval rights to secretary/treasurer. If existing patterns conflict, report the conflict and stop for clarification.

## 3.6 Member activity

Determine how the application identifies active/inactive members. Reuse the existing profile/membership status model. Do not invent a new `is_active` field without justification.

## 3.7 Existing offline/draft architecture

Inspect whether the app already uses:

- IndexedDB
- localStorage
- service workers
- offline caches
- mutation queues
- draft mechanisms

Reuse existing infrastructure where appropriate.

## 3.8 Existing UI patterns

Inspect:

- Repertoire song detail
- Tasks Action Center
- navigation badges
- dialogs
- toasts
- forms
- leaderboard-like pages
- mobile layouts

Reuse existing design-system patterns.

---

# 4. STEP 2 — DATA MODEL

After auditing, propose the smallest safe schema.

## 4.1 `mass_part_points`

Reference/configuration table:

```text
mass_part text PRIMARY KEY
points integer NOT NULL
```

Seed exactly:

```text
entrance_song = 1
kyrie = 2
gloria = 1
responsorial_psalm = 1
gospel_acclamation = 2
offertory = 1
sanctus = 1
memorial_acclamation = 1
great_amen = 2
lords_prayer = 1
lamb_of_god = 1
communion_song = 2
recessional_song = 1
```

Members: read-only.

Directors/Super Admin: manage according to existing authorization conventions.

Avoid deleting referenced Mass Parts.

---

# 5. `song_submissions`

For V1, prefer:

```text
song_id uuid NOT NULL REFERENCES songs(id)
```

The core feature is contribution to an existing Repertoire song.

Do **not** combine a new-song proposal workflow unless the existing product requires it. If `song_id` must be nullable, stop and explain the complete new-song lifecycle before implementing.

Base fields:

```text
id uuid PRIMARY KEY
song_id uuid NOT NULL REFERENCES songs(id)
submitted_by uuid NOT NULL REFERENCES profiles(id)
mass_part text NOT NULL REFERENCES mass_part_points(mass_part)
lyrics_content text NOT NULL
status text NOT NULL DEFAULT 'pending'
points_awarded integer NULL
submitted_at timestamptz NOT NULL DEFAULT now()
reviewed_by uuid NULL REFERENCES profiles(id)
reviewed_at timestamptz NULL
rejection_reason text NULL
```

Statuses:

```text
pending
approved
rejected
```

Use the project's existing enum/check-constraint convention where appropriate.

---

# 6. APPROVED-EDIT / REVISION INTEGRITY

Do NOT simply overwrite an approved submission and turn it into `pending` without considering historical points.

Example:

```text
Original Kyrie → approved → +2
Member edits
Revision → pending
```

If revision is rejected, the original approved contribution should remain historically valid.

Prefer a revision/history model such as:

```text
song_submissions
      ↓
submission_revisions
```

or another equivalent architecture.

The agent must inspect the current codebase and propose the smallest safe implementation.

Required conceptual behavior:

```text
Approved
   ↓
Edit
   ↓
New revision pending
   ↓
Approve → new version becomes current
Reject  → previous approved contribution remains valid
```

Do not implement destructive historical edits unless explicitly approved.

---

# 7. POINT SNAPSHOT

Points are determined only when a submission is approved.

Example:

```text
Kyrie = 2
```

Pending:

```text
points_awarded = NULL
```

Approval:

```text
points_awarded = 2
```

If the configuration later changes to 5, historical approved records remain 2.

`points_awarded` is a historical snapshot and should not be recalculated automatically.

---

# 8. ATOMIC APPROVAL / IDEMPOTENCY

Approval must be atomic:

```text
validate pending
   ↓
read current Mass Part points
   ↓
set points_awarded
   ↓
set status=approved
   ↓
set reviewed_by
   ↓
set reviewed_at
   ↓
commit
   ↓
notification
```

Prevent invalid partial states.

Only valid state transitions:

```text
pending → approved
pending → rejected
```

Protect against:

- double clicks
- retries
- stale pages
- two reviewers acting simultaneously

Use conditional state checks such as:

```sql
WHERE id = :id AND status = 'pending'
```

where appropriate.

---

# 9. DUPLICATE PREVENTION

Only one approved contribution may exist for:

```text
(song_id, mass_part)
```

Application-level checks are required for good UX, but also evaluate a database-level partial unique index:

```text
UNIQUE(song_id, mass_part)
WHERE status = 'approved'
```

Do not apply this until the revision model has been resolved.

## Multiple pending submissions

Recommended:

```text
Multiple pending submissions are allowed.
```

This lets multiple members contribute and lets the Director choose the best.

Once one becomes approved, competing pending submissions must be handled deterministically, e.g. rejected with:

```text
This part has already been covered by another approved contribution.
```

If the project requirements instead require only one pending submission, report that before implementation.

---

# 10. RLS / SECURITY

Security must not rely on hidden UI controls.

## Members

Can:

```text
INSERT their own submission
SELECT their own submissions
```

Cannot:

```text
approve
reject
award points
change reviewer fields
change another member's data
```

## Director / Super Admin

Can review and approve/reject as authorized.

Prefer controlled server actions/RPCs for review mutations rather than broad client UPDATE permissions.

Do not let client input control:

```text
submitted_by
points_awarded
status
reviewed_by
reviewed_at
```

Derive them server-side.

---

# 11. REJECTION

Rejection requires a non-empty reason.

Server-side:

```text
trim(reason).length > 0
```

Recommended maximum: 1000 characters or existing project standard.

On rejection:

```text
status = rejected
rejection_reason = reason
reviewed_by = authenticated reviewer
reviewed_at = server timestamp
```

On resubmission, reset the current review state appropriately.

If revision history exists, preserve historical rejection reasons.

---

# 12. LYRICS VALIDATION / SAFETY

Require:

```text
trim(lyrics_content).length > 0
```

Do not accept whitespace-only content.

Lyrics are untrusted user content.

Prefer plain text or the project's existing safe lyric format.

Do not inject arbitrary HTML or unsafe user-generated markup.

---

# 13. LEADERBOARD

Do not maintain a manually synchronized points-total table unless the existing architecture makes this necessary.

Aggregate approved contributions server-side/database-side:

```text
SUM(points_awarded)
WHERE status = 'approved'
GROUP BY submitted_by
```

Join profiles for the existing display-name convention.

Include:

```text
member_id
display_name
total_points
most_recent_contribution
rank
```

Do not calculate the leaderboard by downloading all raw submissions to the browser.

---

# 14. WEEKLY / MONTHLY / ALL-TIME

The original aggregate view only supports all-time. Explicitly implement period filtering.

Use `reviewed_at`, because points are earned at approval.

## Weekly

Approved contributions where:

```text
reviewed_at >= start of current week
```

## Monthly

Approved contributions where:

```text
reviewed_at >= start of current calendar month
```

## All-Time

All approved contributions.

Use the application's/database timezone convention. Do not let different browsers produce inconsistent period boundaries.

The agent must inspect existing timezone handling before implementation.

---

# 15. LEADERBOARD RANKING

Recommended ordering:

```text
total_points DESC
most_recent_contribution DESC
display_name ASC
```

Use deterministic tie ranking.

Recommended standard competition ranking:

```text
1
1
3
```

The logged-in user's own rank must remain visible even when outside the displayed top range.

---

# 16. ACTIVE MEMBERS / ALL-TIME

Support:

```text
Active Members
All Members / All-Time
```

Use the existing member/profile/membership status.

Do not hard-delete historical contribution records merely because a member leaves.

Expected behavior:

```text
Active leaderboard → exclude inactive members
All-Time → preserve historical contributors
```

If profiles are hard-deleted today, report the risk before implementation.

---

# 17. MEMBER UI — SONG DETAIL

On the Repertoire song detail page, show:

```text
Lyrics Coverage

✓ Kyrie — Covered
✓ Gloria — Covered
◐ Sanctus — Under Review
○ Offertory — Missing
○ Communion Song — Missing
```

States:

```text
Approved
Pending
Missing
```

Do not represent pending as missing.

---

# 18. CONTRIBUTE LYRICS

Form:

```text
Mass Part
Lyrics
Point Preview
Submit
```

Only show eligible Mass Parts.

The point preview is informational. The backend must retrieve the authoritative point value again during approval.

Example:

```text
Mass Part: Kyrie

Potential Reward: +2 points
```

---

# 19. MOBILE DRAFT AUTOSAVE

Inspect existing offline/draft architecture first.

Preferred V1 if compatible:

```text
local draft storage
```

Store:

```text
song_id
mass_part
lyrics_content
last_saved_at
```

Debounce autosave.

Protect against accidental data loss on mobile.

Offline drafting may work without connectivity.

Final submission should require connectivity unless an existing reliable offline mutation queue is already present.

Never tell the user submission succeeded when it did not reach the server.

---

# 20. MY SUBMISSIONS

Member view should show:

```text
Song
Mass Part
Status
Submitted Date
Points Earned
```

Rejected items show:

```text
Rejection Reason
```

Provide:

```text
Edit & Resubmit
```

For approved items, use the revision model rather than destructive editing.

---

# 21. DIRECTOR / ADMIN REVIEW QUEUE

Reuse the Tasks Action-Center pattern.

Navigation:

```text
Lyrics Review [pending count]
```

Sort:

```text
oldest first
```

Each item:

```text
Member
Song
Mass Part
Points at stake
Submitted timestamp
Lyrics preview
```

Add pagination/infinite loading.

Recommended filters:

```text
Mass Part
Song
Member
```

---

# 22. FULL REVIEW

Allow the reviewer to open a full submission:

```text
Song
Mass Part
Contributor
Submitted date
Lyrics
Potential points
Revision/history if available
```

Actions:

```text
Approve
Reject
```

---

# 23. APPROVAL

Approval should provide clear feedback:

```text
✓ Lyrics approved
+2 points awarded
```

Do not award points client-side.

---

# 24. REJECTION

Reject dialog:

```text
Reason:
[................................]

[ Reject Submission ]
[ Cancel ]
```

Reason required in UI and server.

---

# 25. PUSH NOTIFICATIONS

Reuse `push.ts`.

Approval example:

```text
Your Kyrie lyrics were approved! +2 points
```

Rejection should include the reason and a link/deep-link back to edit/resubmit if the existing app supports deep links.

Important:

```text
Database approval/rejection
       ↓
COMMIT
       ↓
Notification attempt
```

Notification failure must not undo a successful approval/rejection.

Avoid duplicate notifications caused by retries.

---

# 26. AUDIT LOGGING

Log every approval/rejection using the existing `audit.ts` pattern.

Suggested event names only if compatible with existing naming conventions:

```text
lyrics_submission_approved
lyrics_submission_rejected
```

Record useful metadata:

```text
submission_id
song_id
mass_part
submitted_by
reviewed_by
points_awarded
rejection_reason
timestamp
```

Do not create a second audit system.

---

# 27. REALTIME / REFRESH

Inspect whether Supabase Realtime is already used.

If appropriate, use the existing pattern for:

- pending review count
- review queue
- submission status
- leaderboard refresh

Do not introduce realtime subscriptions unnecessarily.

Correctness comes first.

---

# 28. RACE CONDITIONS

Handle:

```text
Member A submits Kyrie
Member B submits Kyrie
Director approves A
Director tries to approve B
```

B must fail safely once A is approved.

Also handle:

```text
Director A approves
Director B rejects
```

at nearly the same time.

Stale clients must not overwrite newer states.

---

# 29. PERFORMANCE

Inspect expected data volume and existing indexes.

Potential indexes to evaluate:

```text
song_submissions(status)
song_submissions(submitted_by)
song_submissions(reviewed_at)
song_submissions(song_id, mass_part)
```

Do not blindly create every index.

Use server/database aggregation.

Use pagination.

Debounce autosave.

Avoid fetching unlimited submissions.

Avoid unnecessary repeated queries/realtime subscriptions.

---

# 30. UX / ACCESSIBILITY

Match the existing Choir App design system.

Reuse:

- existing cards
- buttons
- badges
- dialogs
- typography
- spacing
- navigation
- Action Center
- loading/skeletons
- toasts

Prioritize:

```text
clarity
fast review
mobile usability
low cognitive load
accessibility
```

Support:

- keyboard navigation
- visible focus
- semantic controls
- labels
- accessible errors
- adequate contrast
- screen-reader-friendly status

---

# 31. EMPTY / LOADING STATES

Examples:

```text
All Mass Parts have approved lyrics.
```

```text
You haven't submitted any lyrics yet.
```

```text
No lyrics are waiting for review.
```

Use existing skeleton/loading patterns.

---

# 32. ERROR HANDLING

Handle:

- unauthorized user
- invalid song
- invalid Mass Part
- empty lyrics
- missing submission
- already-reviewed submission
- duplicate approved contribution
- missing rejection reason
- network failure
- notification failure
- database constraint errors
- inactive/deleted member cases

Show human-readable errors.

Never expose raw database errors to members.

---

# 33. FILE CHANGE PLAN

After the audit, provide an exact file-by-file plan.

For every file:

```text
path
CREATE / MODIFY
purpose
major logic
dependencies
risk
```

Inspect actual repository paths first. Do not invent duplicate modules.

Likely areas may include:

```text
Repertoire song detail
Lyrics contribution form
My submissions
Lyrics Review queue
Leaderboard
Server actions
Supabase queries
Validation schemas
Notifications
Audit
Types
Tests
```

---

# 34. MIGRATION PLAN

After the audit, propose exact SQL but DO NOT APPLY IT.

Include, as necessary:

```text
CREATE TABLE
CREATE INDEX
CREATE POLICY
CREATE VIEW
CREATE FUNCTION/RPC
SEED DATA
```

Explain:

- purpose
- dependencies
- migration order
- RLS impact
- rollback considerations
- data integrity risks

Wait for explicit approval.

---

# 35. TEST PLAN

## Member

- valid submission
- empty/whitespace lyrics rejected
- own submissions visible
- unauthorized submissions inaccessible
- rejected submission editable
- resubmission
- draft autosave/recovery
- leaderboard access

## Director/Super Admin

- pending queue
- full review
- approve
- reject
- rejection without reason rejected
- duplicate approval prevented
- stale review handled
- notification triggered
- audit event created

## Points

- correct Mass Part value
- snapshot at approval
- historical points unchanged after configuration changes
- rejected items don't add new points
- revision behavior correct
- no duplicate awards

## Leaderboard

- weekly
- monthly
- all-time
- active/all members
- ties
- current user's rank
- empty state

## Security

- RLS
- role escalation
- direct API manipulation
- cross-member access
- client-supplied points/status
- unauthorized approval

## Concurrency

- simultaneous submissions
- simultaneous approvals
- approval/rejection race
- duplicate approved race

---

# 36. ACCEPTANCE CRITERIA

The feature is complete only when:

### Member

- sees Approved/Pending/Missing Mass Parts
- can submit lyrics
- sees point preview
- draft is protected
- sees submission status
- sees rejection reason
- can resubmit
- sees leaderboard

### Reviewer

- sees pending count
- reviews submissions
- approves
- rejects with required reason
- cannot duplicate points
- receives clear feedback

### Backend

- RLS is correct
- reviewer authorization is server-side
- points are snapshotted atomically
- historical points are stable
- only one approved contribution exists per song/Mass Part
- race conditions are safe
- audit logs exist
- notifications occur after committed state changes

### Leaderboard

- only approved points count
- weekly works
- monthly works
- all-time works
- active/all-member filtering works
- ranking is deterministic
- current user's rank is discoverable

---

# 37. REQUIRED AUDIT REPORT FORMAT

Before writing any code, return:

## A. Current Database State

```text
songs:
...

Existing submission tables:
...

Existing point/leaderboard structures:
...
```

## B. Current Security / Roles

```text
Authentication:
...

Roles:
...

RLS:
...
```

## C. Existing Notification Pattern

```text
push.ts:
...
```

## D. Existing Audit Pattern

```text
audit.ts:
...
```

## E. Existing UI / UX Patterns

```text
Song detail:
...

Action Center:
...
```

## F. Existing Offline/Draft Pattern

```text
...
```

## G. Conflicts / Risks

List every conflict between this specification and the current application.

## H. Recommended Architecture

Explain the final proposed design, especially:

1. revision/history model
2. duplicate prevention
3. leaderboard period calculation
4. role permissions
5. RLS
6. draft storage
7. notification flow

## I. Proposed Migration SQL

Show SQL only. Do not execute it.

## J. File Change Plan

List exact repository paths and proposed changes.

## K. STOP

End the audit with:

```text
AUDIT COMPLETE — WAITING FOR USER APPROVAL.

No database or code changes have been applied.
```

Do not proceed until the user explicitly approves the proposed implementation.
