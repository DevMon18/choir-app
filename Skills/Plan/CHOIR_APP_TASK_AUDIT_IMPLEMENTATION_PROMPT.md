# Choir App — Task Expiration, Completion, Archiving & Retention
## Audit + Implementation Prompt for Antigravity / Gemini Agent

> **IMPORTANT:** This is an audit-first implementation prompt. The agent must inspect the existing application before changing code or database structure.

---

# 1. ROLE

You are acting as a senior:
- Full-stack engineer
- Supabase/PostgreSQL architect
- Frontend engineer
- UX/UI engineer
- Performance engineer
- Security/RLS auditor
- QA engineer

Your task is to **FIRST AUDIT** the existing Choir App implementation before modifying anything.

Do not immediately implement the requested changes.

First understand:
- Existing application architecture
- Task data model
- Task assignment model
- Dashboard queries
- Supabase schema
- RLS policies
- Authentication and roles
- Date/time handling
- Frontend state/cache
- Existing UI components
- Existing migrations
- Existing scheduled jobs

After the audit, produce a detailed implementation plan.

Only then implement the approved changes.

---

# 2. PRIMARY OBJECTIVES

Improve the Choir App task system so that:

1. Tasks due today remain active until the actual end of the day.
2. Tasks do not disappear merely because their due date has passed.
3. Members can optionally provide a completion comment.
4. Completed/cannot-complete assignments are archived rather than immediately deleted.
5. Admin/Director users retain visibility of completed/archived task history.
6. Archived records can be permanently deleted after 30 days through controlled cleanup.
7. Existing permissions, RLS, notifications, UI, and task relationships remain intact.
8. The implementation does not introduce unnecessary architectural changes.

---

# 3. AUDIT FIRST — DO NOT CODE YET

Before making changes, inspect the entire repository.

Search for:

```text
task
tasks
task_assignment
assignment
due_date
deadline
expires
expired
today
completed
cannot_complete
archived_at
completion_comment
```

Inspect:
- Dashboard pages
- Task components
- Task hooks
- API/service functions
- Supabase queries
- Database migrations
- RLS policies
- RPC functions
- Edge Functions
- Notifications
- Date utilities
- Cache/state management
- Admin task views
- Member task views

Do not assume the bug exists in only one file.

Trace the complete data flow.

---

# 4. REQUIRED AUDIT REPORT

Before implementation, produce the following.

## A. Current Architecture

Explain:
- Task tables
- Assignment tables
- Member relationships
- Task status model
- Dashboard query
- Admin query
- Frontend task components
- Backend/service layer
- Supabase functions
- RLS policies
- Notification system

## B. Current Bug

Identify exactly why tasks due today disappear around 12:00 PM.

Provide:

```text
File:
Function:
Query:
Condition:
Current behavior:
Expected behavior:
Root cause:
```

Do not guess.

Trace the actual code.

## C. Date/Timezone Analysis

Determine:
- Database timezone behavior
- Column type for `due_date`
- Browser timezone usage
- Server timezone usage
- Supabase timezone behavior
- Existing date utilities
- Whether the app explicitly uses `Asia/Manila`

## D. Data Model Analysis

Determine whether the application follows:

```text
Task
  ↓
Member
```

or:

```text
Task
  ↓
Task Assignment
  ↓
Member
```

This affects where completion comments should be stored.

## E. Security Analysis

Inspect:
- Authentication
- Role checks
- RLS
- Member ownership rules
- Admin/Director permissions
- Task mutation permissions

## F. Performance Analysis

Check:
- Database query efficiency
- Indexes
- N+1 queries
- Client-side filtering
- Unnecessary task fetching
- Cache invalidation
- Re-render behavior

## G. Files To Modify

List:

```text
Existing files to modify
New files
Database migrations
Tests
Configuration
```

---

# 5. CRITICAL TIMEZONE REQUIREMENT

The application must use an explicit business timezone.

Default:

```text
Asia/Manila
```

unless the existing application already has a configurable organization timezone.

Do not allow task expiration to depend on:
- Browser timezone
- Server timezone
- UTC-only comparison
- User computer timezone

For a task due on:

```text
2026-08-22
```

the task must remain active until the end of that business day:

```text
2026-08-22 23:59:59 Asia/Manila
```

It must NOT expire at:
- `12:00 PM`
- `00:00 UTC`
- Any other incorrect timezone boundary

---

# 6. DATE-ONLY VS TIMESTAMP AUDIT

Determine whether `due_date` is:

```text
date
timestamp
timestamptz
```

Do not change the column type unnecessarily.

If `due_date` represents a calendar date rather than an exact time, treat it as the entire business day.

Prefer robust half-open interval logic when appropriate:

```text
due_date < next_day_start
```

rather than relying only on manually constructed `23:59:59` timestamps.

---

# 7. FIX TASK EXPIRATION LOGIC

The user's active dashboard must NOT use date expiration as the primary visibility rule.

Do not use:

```sql
WHERE due_date >= CURRENT_DATE
```

or:

```sql
WHERE due_date >= NOW()
```

to decide whether a task remains visible.

A task becoming overdue does NOT mean that it should disappear.

---

# 8. CORRECT MEMBER DASHBOARD VISIBILITY

The active member dashboard should primarily be based on:

```text
Current member owns the assignment
AND
archived_at IS NULL
AND
status NOT IN ('completed', 'cannot_complete')
```

Conceptually:

```sql
WHERE member_id = current_user
  AND archived_at IS NULL
  AND status NOT IN ('completed', 'cannot_complete')
```

Adapt this to the actual schema.

Do not blindly copy this SQL if the existing schema differs.

---

# 9. OVERDUE TASKS MUST REMAIN VISIBLE

An overdue task must remain visible.

Example:

```text
Task:
Choir Uniform Preparation

Due:
August 20

Status:
OVERDUE
```

The user should still be able to:
- Continue Task
- Request Reassignment
- Report Blocker
- Mark Cannot Complete

The task should disappear from the active dashboard only after an explicit terminal action.

---

# 10. STATUS VS ARCHIVE STATE

Do not mix status and archive state.

Status describes what happened:

```text
pending
in_progress
blocked
completed
cannot_complete
reassignment_requested
reassigned
cancelled
```

Archive state describes whether the item should remain in the user's active dashboard.

Example:

```text
status = completed
archived_at = current timestamp
```

Admin history should still be able to retrieve the record.

---

# 11. COMPLETION COMMENT — ARCHITECTURAL DECISION

The original requirement proposes:

```sql
tasks.completion_comment TEXT NULL
```

Do NOT blindly implement this.

First determine whether multiple members can have different responsibilities under the same parent task.

Example:

```text
Task:
Choir Uniform Preparation

Juan:
Canvas the linen

Maria:
Design the uniform

Carlo:
Coordinate with tailor

Ana:
Calculate budget
```

If each assignment can have its own completion response, the preferred structure is likely:

```text
task_assignments.completion_comment
```

rather than:

```text
tasks.completion_comment
```

The agent must inspect the existing schema and explain which approach is correct.

Do not duplicate completion comments across both tables unless there is a clear architectural reason.

---

# 12. OPTIONAL COMPLETION COMMENT

When a user selects:

```text
Complete Task
```

show a confirmation interface.

Example:

```text
Complete Task

Are you sure you want to mark this task as completed?

Completion note (optional)

[________________________________]
[________________________________]

[Cancel] [Complete Task]
```

The comment must be optional.

An empty comment must be valid.

Whitespace-only input should be handled appropriately.

---

# 13. COMPLETION DATA

When the assignment is completed, preserve:

```text
status
completion_comment
completed_at
archived_at
```

If the existing architecture supports history/audit records, also record the completion event.

Recommended flow:

```text
Validate user
      ↓
Validate assignment ownership
      ↓
Validate status transition
      ↓
Save completion comment
      ↓
Set completed_at
      ↓
Set archived_at
      ↓
Create history record if supported
      ↓
Return success
```

Avoid inconsistent multi-request updates where possible.

Use the existing RPC/service/transaction architecture if available.

---

# 14. CANNOT COMPLETE

Members should also be able to explicitly indicate that they cannot complete a task.

Recommended UI:

```text
Cannot Complete

Please provide a reason.

[________________________________]
[________________________________]

[Cancel] [Submit]
```

Do not automatically archive a task merely because it is overdue.

Only explicit user action should move it to the terminal `cannot_complete` state.

Inspect whether the existing application already has:
- request
- blocker
- reassignment
- reason
- comment

fields before adding another column.

---

# 15. ARCHIVING

Completing or dismissing a task should NOT immediately destroy the record.

Use:

```text
archived_at
```

to indicate that the item has left the active member dashboard.

Example:

```text
status = completed
archived_at = 2026-08-22 15:30:00
```

or:

```text
status = cannot_complete
archived_at = 2026-08-22 15:30:00
```

---

# 16. MEMBER DASHBOARD AFTER COMPLETION

After completion:

```text
Active Tasks
```

should no longer display the assignment.

However, the record must remain available to authorized:
- Directors
- Super Admins

according to existing permissions.

---

# 17. ADMIN TASK HISTORY

Admin/Director views should be able to display archived/completed tasks.

Recommended information:

```text
Task
Member
Responsibility
Status
Due Date
Completed At
Archived At
Completion Comment
```

If there is no comment:

```text
No completion comment provided.
```

---

# 18. ADMIN FILTERS

The Admin/Director task interface should support filters where appropriate:

```text
All
Active
Pending
In Progress
Blocked
Overdue
Completed
Cannot Complete
Archived
```

Do not force all filters into the member interface.

Keep the member UI simple.

---

# 19. OVERDUE LOGIC

Overdue should be derived from the due date and current business date/time.

Conceptually:

```text
due_date < today
AND
status NOT IN ('completed', 'cannot_complete')
AND
archived_at IS NULL
```

The exact implementation must respect the database column type and timezone.

Overdue is a display/state condition.

It is NOT:
- delete
- archive
- complete
- cannot_complete

---

# 20. DO NOT AUTO-COMPLETE

A task becoming overdue must NOT automatically become:
- `completed`
- `cannot_complete`
- `archived`

It remains active.

---

# 21. DATA RETENTION

Archived operational records should remain available for:

```text
30 days
```

Lifecycle:

```text
Active
  ↓
Completed / Cannot Complete
  ↓
archived_at populated
  ↓
30 days
  ↓
Permanent cleanup
```

---

# 22. SUPABASE PG_CRON AUDIT

Before implementing `pg_cron`:

1. Determine whether the extension is available.
2. Determine whether the project already uses it.
3. Inspect existing scheduled jobs.
4. Inspect Supabase project configuration.
5. Check whether an Edge Function scheduler already exists.
6. Check whether database deletion is safe.

Do not blindly enable or configure extensions.

---

# 23. CLEANUP REQUIREMENT

The cleanup should run daily.

Target records where:

```text
archived_at IS NOT NULL
AND
archived_at < NOW() - INTERVAL '30 days'
```

However, do NOT blindly delete parent records.

First inspect:
- Foreign keys
- ON DELETE behavior
- Task assignments
- Task history
- Comments
- Attachments
- Requests
- Notifications
- Audit records

Determine what must be deleted and what should be retained.

---

# 24. AUDIT/HISTORY RETENTION

Do not destroy important accountability records just because the operational task is old.

Classify data:

```text
Operational data
Historical data
Audit data
Attachments
Notifications
```

If the application needs an audit trail, consider retaining:

```text
task_assignment_history
```

even after the operational assignment is permanently deleted.

Provide a recommendation before implementation.

---

# 25. CLEANUP IMPLEMENTATION

If direct `pg_cron` cleanup is safe, create an appropriate scheduled job.

Conceptually:

```sql
DELETE FROM task_assignments
WHERE archived_at IS NOT NULL
  AND archived_at < NOW() - INTERVAL '30 days';
```

IMPORTANT:

This is only conceptual.

Do not execute this exact statement until the agent has inspected:
- Foreign keys
- Dependencies
- RLS
- Existing cleanup functions
- Audit requirements

If direct deletion is unsafe, use:
- Database function
- Supabase Edge Function

as appropriate.

---

# 26. CLEANUP SCHEDULE

Run the cleanup once per day during a low-traffic period.

Document:

```text
Schedule
Timezone
Function/job name
Tables affected
Retention rule
Failure behavior
```

---

# 27. INDEXING

Inspect existing indexes before creating new ones.

Potential query fields:

```text
member_id
status
archived_at
due_date
```

Do not blindly create indexes.

Determine the actual query pattern and whether composite indexes would provide better performance.

---

# 28. PERFORMANCE

The task dashboard must:

- Filter in the database
- Avoid downloading archived tasks
- Avoid downloading unnecessary completed tasks
- Avoid N+1 queries
- Avoid large client-side filtering
- Use appropriate indexes
- Select only required columns
- Preserve pagination where appropriate
- Avoid unnecessary re-renders
- Use existing caching mechanisms

Do not fetch every task and filter it in React.

---

# 29. FRONTEND CACHE

Inspect whether the app uses:

```text
React Query
SWR
Next.js caching
Server Components
Context
Redux
Zustand
Custom hooks
```

After successful completion:

```text
Task mutation
      ↓
Database update
      ↓
Cache invalidation/update
      ↓
Task disappears from active list
```

The page should not require a full browser refresh.

If optimistic UI exists:

```text
Update UI
      ↓
Perform mutation
      ↓
Rollback if mutation fails
```

Ensure the completion comment is preserved.

---

# 30. UI/UX

Use the existing Choir App design system.

Follow:
- Visual hierarchy
- Accessible forms
- Proper loading states
- Error states
- Empty states
- Toast feedback
- Confirmation dialogs
- Mobile responsiveness
- Keyboard accessibility
- Reduced-motion support

Do not introduce an unrelated visual design.

Reuse existing components whenever possible.

---

# 31. COMPLETE TASK UI

Desktop:

```text
Task Details

Title
Responsibility
Due Date
Priority
Status

[Complete Task]
```

Clicking `Complete Task` opens:

```text
Complete Task

Completion note (optional)

[________________________________]
[________________________________]

[Cancel] [Complete Task]
```

On success:

```text
✓ Task completed successfully
```

The active task should disappear without requiring a full page reload.

---

# 32. ERROR HANDLING

If completion fails:

```text
Unable to complete task.

Your task was not changed.

[Try Again]
```

Do not silently fail.

If an optimistic update was performed, restore the previous state.

---

# 33. SECURITY REQUIREMENTS

The frontend must NOT be the only authorization layer.

A member must NOT be able to:
- Complete another member's assignment
- Archive another member's assignment
- Change another member's completion comment
- Modify another user's task
- Delete archived records
- Approve their own reassignment request
- Bypass authorization

RLS/backend authorization must enforce these rules.

---

# 34. ROLE EXPECTATIONS

Respect the existing application roles.

Typical model:

| Action | Member | Director | Super Admin |
|---|---:|---:|---:|
| View own tasks | YES | YES | YES |
| Complete own task | YES | YES | YES |
| Add completion comment | YES | YES | YES |
| View completed history | Based on existing policy | YES | YES |
| View all tasks | NO | YES | YES |
| Manage tasks | NO | YES | YES |
| View archived tasks | Limited/NO | YES | YES |
| Permanent cleanup | NO | NO | System/Admin process |

Adapt this table to the actual role model found in the repository.

---

# 35. TESTING — DATE LOGIC

Test at minimum:

```text
Due today at 00:01
Due today at 08:00
Due today at 11:59
Due today at 12:00
Due today at 18:00
Due today at 23:59
Due today at 23:59:59
Due yesterday
Due tomorrow
```

All tasks due today must remain active throughout the business day.

---

# 36. TESTING — COMPLETION

Test:

```text
Complete with comment
Complete without comment
Complete with empty comment
Complete with whitespace-only comment
Complete with long comment
Complete when already completed
Complete another user's task
```

Expected:
- Valid completion succeeds.
- Optional comment is preserved.
- Invalid/unauthorized mutations fail safely.

---

# 37. TESTING — VISIBILITY

Verify:

```text
Active task
→ Visible to member

Overdue task
→ Still visible to member

Completed task
→ Hidden from active member dashboard

Cannot-complete task
→ Hidden from active member dashboard

Archived task
→ Visible to authorized Admin/Director history
```

---

# 38. TESTING — RETENTION

Test:

```text
Archived 1 day ago
→ Retained

Archived 29 days ago
→ Retained

Archived 30 days ago
→ Follow defined retention boundary

Archived 31 days ago
→ Eligible for cleanup
```

Clearly document whether the exact boundary is:

```text
> 30 days
```

or:

```text
>= 30 days
```

and implement consistently.

---

# 39. TESTING — TIMEZONE

Explicitly test:

```text
Asia/Manila
```

while changing the browser timezone if possible.

The application's behavior must remain based on the configured business timezone.

Do not rely on:

```js
new Date()
```

without understanding the timezone semantics.

---

# 40. MIGRATION SAFETY

Before applying database changes:

1. Inspect current schema.
2. Inspect migration conventions.
3. Check whether columns already exist.
4. Check existing data.
5. Inspect foreign keys.
6. Inspect RLS.
7. Inspect dependent functions.
8. Inspect views.
9. Create migration.
10. Validate migration.
11. Test affected queries.

Do not destroy existing data.

---

# 41. IMPLEMENTATION ORDER

Use this order:

```text
1. Repository audit
        ↓
2. Task architecture audit
        ↓
3. Date/timezone audit
        ↓
4. Dashboard query audit
        ↓
5. Database schema audit
        ↓
6. RLS/security audit
        ↓
7. Determine completion-comment location
        ↓
8. Design migration
        ↓
9. Fix dashboard visibility
        ↓
10. Implement completion comment
        ↓
11. Implement archiving
        ↓
12. Update Admin history UI
        ↓
13. Implement retention cleanup
        ↓
14. Update cache/state
        ↓
15. Tests
        ↓
16. Performance audit
        ↓
17. Security audit
```

---

# 42. DO NOT OVER-REFACTOR

Do not:
- Rewrite the entire task system
- Replace working components without evidence
- Introduce unnecessary dependencies
- Change unrelated features
- Change database architecture without justification
- Duplicate existing components
- Duplicate existing notification systems
- Duplicate existing date utilities

Prefer:

```text
Inspect
→ Reuse
→ Extend
→ Fix
→ Test
```

over:

```text
Rewrite everything
```

---

# 43. REQUIRED FINAL AUDIT OUTPUT

Before coding, provide:

## 1. Current Architecture

Explain the existing task system.

## 2. Root Cause

Show the exact reason tasks expire/disappear around noon.

## 3. Timezone Analysis

Explain how the application currently handles dates and timezone.

## 4. Data Model

Show:

```text
tasks
task_assignments
task history
requests
notifications
```

and their relationships.

## 5. Completion Comment Recommendation

Explicitly state:

```text
Recommended table:
Recommended column:
Reason:
```

Example:

```text
Recommended table:
task_assignments

Recommended column:
completion_comment TEXT NULL

Reason:
Each member can have a different responsibility and completion response.
```

Only recommend `tasks.completion_comment` if the existing architecture confirms that completion belongs at the parent-task level.

## 6. Query Changes

Show the current query and proposed query.

## 7. Database Changes

Show:

```text
Migration
Columns
Indexes
RLS changes
Functions
Triggers
```

## 8. Retention Strategy

Explain:

```text
Archive
→ Retain 30 days
→ Cleanup
```

## 9. Security Impact

Explain RLS and authorization changes.

## 10. Performance Impact

Explain query/index/cache improvements.

## 11. UX Changes

Explain the new completion workflow.

## 12. Test Plan

List unit/integration/E2E tests.

## 13. Files To Change

List exact files.

---

# 44. FINAL ACCEPTANCE CRITERIA

The implementation is successful only if:

### Today's Tasks

A task due today remains visible throughout the day and does not disappear at noon.

### Overdue Tasks

Overdue tasks remain visible indefinitely until the user explicitly changes their state to:

```text
completed
```

or:

```text
cannot_complete
```

### Completion Comment

Users can optionally provide a completion note.

The note is persisted and visible to authorized Admin/Director users.

### Archiving

Completion/cannot-complete archives the operational assignment instead of immediately deleting it.

### Admin Visibility

Admin/Director users can view completed/archived history.

### Retention

Archived operational records are eligible for cleanup after 30 days.

### Security

Members cannot modify other members' assignments or bypass authorization.

### Performance

The dashboard filters tasks efficiently at the database/query layer.

### UX

The workflow works correctly on:

```text
Desktop
Tablet
Mobile
```

and follows the existing Choir App design system.

---

# 45. FINAL INSTRUCTION TO THE AGENT

**DO NOT START CODING IMMEDIATELY.**

First:

```text
AUDIT
  ↓
IDENTIFY ROOT CAUSE
  ↓
ANALYZE CURRENT ARCHITECTURE
  ↓
PROPOSE SOLUTION
  ↓
SHOW DATABASE IMPACT
  ↓
SHOW FILES TO MODIFY
  ↓
SHOW TEST PLAN
```

Then wait for approval before performing high-impact database or architectural changes.

If the requested implementation conflicts with the existing architecture, do not force it.

Explain the conflict and recommend the safest solution.

The goal is not merely to make the bug disappear.

The goal is to produce a task system that is:

- Correct
- Secure
- Persistent
- Auditable
- Performant
- Responsive
- Maintainable
- Consistent with the existing Choir App architecture
