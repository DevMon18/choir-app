# Choir App — UX/UI Enhancement & Task Workflow Specification

## Purpose

This document defines the recommended UX/UI direction and task-management workflow for the Choir App.

It is intended to be fed to the Antigravity IDE / Gemini coding agent as a **design and implementation reference**.

The goal is not to copy another website. The goal is to apply proven UX patterns and principles appropriately to the Choir App's existing architecture, visual identity, accessibility requirements, responsive behavior, and user roles.

Reference:
- DesignMotionHQ UX Pattern Library: https://www.designmotionhq.com/patterns

The DesignMotionHQ library currently groups patterns across content, feedback, forms, interaction, motion, navigation, and visual design. Relevant patterns include Visual Hierarchy, Navigation Patterns, Search Experience System, Data Table, Notification System, Loading States, Empty States, Error States, Form Field States, Toast Notifications, Optimistic UI, File Upload UX, Modal Hierarchy, Bottom Sheets, Tabs, Accordion Disclosure, Focus States, Undo UX, Design Tokens, Color Accessibility, Dark Mode, and related interaction/motion patterns.

---

# 1. Core Design Philosophy

The Choir App should feel:

- Clean
- Modern
- Professional
- Fast
- Calm
- Easy to understand
- Mobile-friendly
- Accessible
- Consistent
- Purpose-driven

Do not add visual effects merely because they look impressive.

Every animation, color, modal, card, badge, tooltip, and interaction should have a clear UX purpose.

Prioritize:

1. Clarity
2. Task completion
3. Information hierarchy
4. Feedback
5. Accessibility
6. Performance
7. Consistency
8. Delight

---

# 2. Design System Foundation

Before implementing large UI changes, inspect the existing application and determine whether it already has:

- Design tokens
- Color variables
- Typography system
- Spacing scale
- Border-radius scale
- Shadows/elevation
- Component variants
- Button system
- Input system
- Dialog/modal system
- Toast system
- Badge system
- Loading system
- Empty-state system
- Error-state system
- Responsive breakpoints

Do not introduce duplicate systems.

If an existing design system is good, extend it.

If it is inconsistent, propose a gradual consolidation.

---

# 3. Design Tokens

Use semantic tokens rather than scattered values.

Recommended conceptual categories:

```text
Colors
Typography
Spacing
Radius
Borders
Shadows
Elevation
Motion
Z-index
Breakpoints
```

Examples of semantic colors:

```text
background
foreground
muted
primary
secondary
success
warning
danger
info
border
surface
```

Do not hard-code colors throughout components.

---

# 4. Visual Hierarchy

Every screen should have an intentional hierarchy.

The user should immediately understand:

1. Where am I?
2. What is most important?
3. What can I do?
4. What requires my attention?
5. What is secondary information?

For dashboards, prioritize:

```text
Page title
→ Important actions
→ Critical information
→ Main content
→ Secondary content
```

Avoid making every card, button, badge, and heading visually loud.

---

# 5. Navigation

Use a consistent navigation model.

## Desktop

Prefer:

```text
Sidebar
    Dashboard
    Members
    Songs
    Repertoire
    Tasks
    Events
    Notifications
    Settings
```

The exact navigation must follow the existing app's information architecture.

## Mobile

Use a mobile-friendly navigation pattern.

Do not simply shrink the desktop sidebar.

Evaluate:

- Bottom navigation
- Drawer
- Sheet
- Contextual action menus

Use the minimum number of primary navigation items needed.

---

# 6. Search Experience

Search should be treated as a system.

For major entities:

- Songs
- Members
- Repertoire
- Tasks

Consider:

```text
Search input
→ Results
→ Loading state
→ Empty state
→ Error state
→ Clear/reset
→ Filters where necessary
```

Search should be responsive and should not cause unnecessary network requests.

Use debouncing where appropriate.

---

# 7. Loading States

Do not use a spinner for everything.

Determine whether the appropriate state is:

```text
Skeleton
Spinner
Progress indicator
Optimistic update
Inline loading
Button loading state
Background sync indicator
```

For example:

### Song list

Use a skeleton if the structure is known.

### Task status update

Use an optimistic update when safe.

### File download

Use progress.

### Sync

Use a subtle synchronization indicator.

---

# 8. Empty States

Every major list must have an intentional empty state.

Examples:

## No Tasks

```text
No tasks yet

Tasks assigned to you will appear here.

[View Tasks]
```

## No Offline Songs

```text
No offline songs

Download songs to access them without an internet connection.

[Browse Songs]
```

## No Repertoire

```text
No repertoire found

Create or browse a repertoire to get started.
```

Avoid empty screens with only:

```text
No data.
```

---

# 9. Error States

Errors should explain:

1. What happened
2. What the user can do
3. Whether the action can be retried

Example:

```text
Unable to load tasks

We couldn't retrieve your tasks right now.

[Try Again]
```

Avoid technical messages such as:

```text
Error 500
Supabase request failed
FetchError
```

unless shown in a developer/debug context.

---

# 10. Notification System

Notifications should be treated as a system.

Use different surfaces for different importance levels.

### Toast

Use for:

- Saved
- Updated
- Download completed
- Minor confirmation

### Inline alert

Use for:

- Important warnings
- Sync problems
- Permission problems

### Notification center

Use for:

- New task
- Reassignment request decision
- Deadline reminder
- Important announcements

### Modal/dialog

Use only when the user must make an important decision.

Do not turn every notification into a modal.

---

# 11. Toast Notifications

Toasts should:

- Be concise
- Have clear meaning
- Avoid blocking work
- Not be overused
- Support success/error/warning/info states
- Allow appropriate duration
- Be accessible

Example:

```text
✓ Task assigned successfully
```

Instead of:

```text
Success!
```

---

# 12. Optimistic UI

Use optimistic UI only where the operation is safe to represent immediately.

Good candidates:

- Mark task in progress
- Mark task complete
- Toggle favorite
- Reorder items where rollback is supported

Do not use optimistic behavior for security-sensitive or destructive operations without proper confirmation/rollback.

---

# 13. Modal Hierarchy

Use the least disruptive interaction appropriate for the task.

### Small confirmation

Use a compact confirmation dialog.

### Complex task creation

Use a full dialog or dedicated page.

### Mobile

Prefer bottom sheets where appropriate.

Do not create multiple nested modals.

---

# 14. Mobile Bottom Sheets

For mobile interactions such as:

- Task actions
- Member actions
- Song actions
- Download actions
- Filter selection

consider bottom sheets instead of tiny dropdowns.

Ensure:

- Large touch targets
- Clear close behavior
- Keyboard handling
- Safe-area support
- Focus management

---

# 15. Forms

Forms must have consistent:

```text
Default
Focus
Filled
Disabled
Error
Success
Loading
```

states.

Validation should generally avoid showing errors while the user is still typing unless immediate feedback is genuinely useful.

Use clear microcopy.

Example:

```text
Due date

Choose when this responsibility should be completed.
```

---

# 16. File Upload UX

For task attachments, use:

```text
Choose file
→ Uploading
→ Progress
→ Uploaded
→ Error/retry
```

Display:

- File name
- File type
- Size
- Upload state
- Remove action

Prevent accidental duplicate uploads where possible.

---

# 17. Task Management — Core Concept

The Choir App should NOT treat tasks as simple checklist items.

Use this model:

```text
TASK
  ↓
RESPONSIBILITIES / ASSIGNMENTS
  ↓
MEMBERS
```

A task represents the overall work.

An assignment represents a specific responsibility delegated to a member.

---

# 18. Example: Choir Uniform

Main task:

```text
Choir Uniform Preparation
```

Responsibilities:

```text
Member A
→ Canvas the linen

Member B
→ Create uniform design

Member C
→ Coordinate with tailor

Member D
→ Calculate total cost
```

This is preferable to simply:

```text
Task:
Choir Uniform

Assigned to:
A, B, C, D
```

because every member has a distinct responsibility.

---

# 19. Task Hierarchy

Recommended structure:

```text
Task
│
├── Title
├── Description
├── Priority
├── Overall deadline
├── Created by
│
└── Responsibilities
      │
      ├── Member
      ├── Responsibility
      ├── Deadline
      ├── Status
      ├── Comments
      ├── Attachments
      └── Requests
```

---

# 20. Task Creation Workflow

Director/Super Admin:

```text
Create Task
    ↓
Define main task
    ↓
Set priority
    ↓
Set overall deadline
    ↓
Add responsibilities
    ↓
Assign each responsibility
    ↓
Set individual deadlines
    ↓
Review
    ↓
Create
```

Example:

```text
Task:
Choir Uniform Preparation

Overall deadline:
September 15

Responsibilities:

Juan
→ Canvas the linen
→ Due September 5

Maria
→ Create uniform design
→ Due September 7

Carlo
→ Coordinate with tailor
→ Due September 10

Ana
→ Calculate budget
→ Due September 8
```

---

# 21. Assignment Model

The system should support:

## Individual assignment

```text
Member A
→ Responsibility
```

## Same responsibility to multiple members

```text
Practice songs
→ Member A
→ Member B
→ Member C
```

## Different responsibilities to different members

```text
Design
→ Maria

Budget
→ Ana

Tailor
→ Carlo
```

## Everyone

Only Director/Super Admin may assign a task to everyone.

---

# 22. Task Permissions

Recommended permission model:

| Action | Member | Director | Super Admin |
|---|---:|---:|---:|
| View own assignments | YES | YES | YES |
| Create task | NO | YES | YES |
| Assign member | NO | YES | YES |
| Assign multiple members | NO | YES | YES |
| Assign everyone | NO | YES | YES |
| Update own assignment status | YES | YES | YES |
| Edit task | NO | YES | YES |
| Reassign directly | NO | YES | YES |
| Request reassignment | YES | YES | YES |
| Approve reassignment | NO | YES | YES |
| Reject reassignment | NO | YES | YES |
| Delete/cancel task | NO | According to policy | YES |
| View overall progress | Own | All | All |

IMPORTANT:

Do not rely only on frontend role checks.

Authorization must be enforced server-side and through the database/RLS architecture where appropriate.

---

# 23. Member Task Experience

Members should primarily see:

```text
MY TASKS
```

Example:

```text
Choir Uniform Preparation

Your responsibility:

Canvas the linen

Due:
September 5

Priority:
High

Status:
In Progress
```

Available actions:

```text
[ Mark Complete ]
[ Report Blocker ]
[ Request Reassignment ]
```

The interface should not expose unnecessary administrative controls.

---

# 24. Director Task Experience

Director should see the whole task.

Example:

```text
CHOIR UNIFORM PREPARATION

Overall Progress
████████░░ 75%

Responsibilities

✓ Juan
Canvas the linen

◐ Maria
Create uniform design

○ Carlo
Coordinate with tailor

✓ Ana
Calculate budget
```

The Director can drill into individual responsibilities.

---

# 25. Task Status

Recommended assignment statuses:

```text
PENDING
IN_PROGRESS
BLOCKED
COMPLETED
OVERDUE
REASSIGNMENT_REQUESTED
REASSIGNED
CANCELLED
```

Do not allow arbitrary status transitions.

Example:

```text
PENDING
→ IN_PROGRESS
→ COMPLETED
```

or:

```text
IN_PROGRESS
→ BLOCKED
```

or:

```text
IN_PROGRESS
→ REASSIGNMENT_REQUESTED
→ REASSIGNED
```

---

# 26. Blocked Tasks

A member may be unable to proceed without needing reassignment.

Example:

```text
Maria
Create uniform design

Status:
BLOCKED

Reason:
Waiting for official choir logo.
```

Director sees:

```text
Blocked Tasks
1

Maria
Create uniform design

Reason:
Waiting for official choir logo.

[ Resolve ]
```

This should be different from reassignment.

---

# 27. Reassignment Workflow

Members should NOT directly transfer their assignment to another member.

Instead:

```text
Member
→ Request Reassignment
→ Director/Super Admin
→ Review
→ Approve or Reject
```

---

# 28. Reassignment Request UI

Member:

```text
Request Reassignment

Current responsibility:
Canvas the linen

Reason:
I cannot complete this because I
do not have access to the required
materials.

Suggested replacement:
[ Select member ]

[ Submit Request ]
```

Suggested replacement should be optional.

The Director remains the final decision-maker.

---

# 29. Director Approval

Director sees:

```text
Reassignment Request

Current member:
Juan

Responsibility:
Canvas the linen

Suggested member:
Pedro

Reason:
Unable to obtain required materials.

[ Reject ]
[ Approve & Reassign ]
```

Approval must happen through an authorized server-side action.

---

# 30. Reassignment Result

Before:

```text
Juan
→ Canvas the linen
```

After approval:

```text
Juan
→ Reassigned

Pedro
→ Canvas the linen
→ Pending
```

Do not delete the original assignment history.

---

# 31. Assignment History

Maintain an audit trail.

Example:

```text
Assignment History

Juan
Assigned: Aug 10
Started: Aug 11
Requested reassignment: Aug 13
Approved: Aug 14

Pedro
Assigned: Aug 14
Started: Aug 15
Completed: Aug 17
```

This provides accountability and transparency.

---

# 32. Deadline Extension

Members may also request more time.

Example:

```text
Request Change

○ Reassignment
● Deadline Extension
○ Clarification
○ Report Blocker
```

Example:

```text
Current deadline:
September 5

Requested deadline:
September 8

Reason:
Supplier delivery was delayed.
```

Director:

```text
[ Reject ]
[ Approve Extension ]
```

---

# 33. Clarification Requests

A member can request clarification without blocking the entire system.

Example:

```text
Maria:
Should the design use the existing
choir logo?

Director:
Yes. Place it on the left chest.
```

Keep the conversation attached to the responsibility/task.

---

# 34. Comments

Tasks/responsibilities should support comments when useful.

Example:

```text
Maria
I finished three design variations.

Director
Please use Design #2.

Maria
Noted.
```

Comments should include:

- Author
- Timestamp
- Content

---

# 35. Attachments

Allow attachments where appropriate.

Examples:

```text
Uniform design
→ PNG/JPG/PDF

Linen sample
→ JPG

Cost estimate
→ PDF/XLSX
```

Use proper file upload UX and authorization.

Do not allow arbitrary unvalidated uploads without security controls.

---

# 36. Notifications

Task events should generate appropriate notifications.

Examples:

```text
New task assigned
Reassignment requested
Reassignment approved
Reassignment rejected
Deadline changed
Task blocked
Task completed
Task overdue
Comment added
```

Use notification surfaces according to importance.

Do not make every event a blocking modal.

---

# 37. Director Action Center

A useful Director dashboard area:

```text
REQUIRES YOUR ACTION

⚠ 1 Reassignment Request
⚠ 2 Deadline Extension Requests
⚠ 2 Blocked Tasks
```

This follows the principle that important unresolved work should remain visible without overwhelming the user.

---

# 38. Task Dashboard

Recommended Director dashboard:

```text
Tasks

Active          24
Completed       48
Overdue          3
Blocked          2
Reassignment     1
Requests         2
```

The numbers should be actionable filters, not decoration.

---

# 39. Task Search and Filtering

Directors should be able to filter by:

```text
Status
Priority
Assignee
Due date
Created by
Task type
Related song
Related repertoire
Related event
```

Members should primarily need:

```text
Status
Due date
Priority
```

Avoid exposing unnecessary complexity to members.

---

# 40. Task Integration With Choir Features

Tasks should be able to relate to existing Choir App entities.

Potential relationships:

```text
Task
├── Song
├── Repertoire
├── Event
└── Member
```

Examples:

```text
Practice Amazing Grace
→ Related Song

Prepare Sunday Worship
→ Related Repertoire

Prepare for Christmas Concert
→ Related Event
```

The user should be able to navigate directly to the related entity.

---

# 41. Task Data Model

Recommended conceptual schema:

```text
tasks

id
title
description
priority
due_date
created_by
created_at
updated_at
```

```text
task_assignments

id
task_id
member_id
responsibility
status
due_date
assigned_by
assigned_at
started_at
completed_at
created_at
updated_at
```

```text
task_requests

id
task_assignment_id
request_type
requested_by
requested_member_id
reason
requested_due_date
status
reviewed_by
reviewed_at
review_note
created_at
updated_at
```

Potential request types:

```text
REASSIGNMENT
DEADLINE_EXTENSION
CLARIFICATION
BLOCKER
```

---

# 42. Assignment History

Recommended conceptual table:

```text
task_assignment_history

id
assignment_id
action
performed_by
old_member_id
new_member_id
old_status
new_status
reason
created_at
```

The exact schema must be adapted to the existing Choir App database.

Do not implement a duplicate or conflicting schema.

---

# 43. Backend and Security Requirements

The frontend must never be the sole authorization layer.

For example, this is insufficient:

```text
if (user.role === "director") {
    showAssignButton();
}
```

Backend/database authorization must enforce:

```text
Member
→ Can only modify their own permitted assignment state.

Director
→ Can create/manage tasks according to role scope.

Super Admin
→ Full task management.

Member
→ Cannot directly reassign themselves to another member.

Member
→ Can create a reassignment request.

Director/Super Admin
→ Can approve/reject request.
```

---

# 44. Reassignment Must Be Transactional

When a Director approves reassignment, the system should safely perform the related operations together:

```text
Validate permission
→ Validate request
→ Update assignment
→ Record history
→ Mark request approved
→ Notify new member
```

Avoid partially completed state.

If the backend/database architecture supports transactions, use them appropriately.

---

# 45. Do Not Delete History

Never turn:

```text
Juan → Pedro
```

into a simple overwrite with no history.

Preserve:

```text
Original assignee
Request
Reason
Approver
Date
New assignee
```

This is important for accountability.

---

# 46. Motion Design

Motion should be subtle and functional.

Use animation for:

- State changes
- Opening/closing panels
- Progress changes
- List insertion/removal
- Confirmation feedback
- Navigation transitions where appropriate

Avoid:

- Excessive bouncing
- Long transitions
- Decorative animation
- Animation that delays task completion

Respect reduced-motion preferences.

---

# 47. Card Interaction

Cards should communicate interaction clearly.

Use hover states only where the element is interactive.

Avoid making every card appear clickable.

For task cards, prioritize:

```text
Task title
Priority
Due date
Status
Responsibility
Primary action
```

---

# 48. Data Tables

For Directors/Admins, tables may be appropriate for large task/member datasets.

A proper data table should support:

- Clear headers
- Sorting where useful
- Filtering
- Pagination or virtualization when necessary
- Row actions
- Responsive behavior
- Keyboard accessibility

Do not render large datasets as an unstructured grid of divs.

---

# 49. Responsive Task UI

Desktop:

```text
Sidebar
Main content
Task details panel
```

Mobile:

```text
Top bar
Task list
Task detail
Bottom-sheet actions
```

Do not simply shrink desktop tables until they become unusable.

For mobile, consider transforming task rows into cards or a stacked layout.

---

# 50. Accessibility

All task workflows must support:

- Keyboard navigation
- Visible focus
- Screen readers
- Proper labels
- Accessible dialogs
- Accessible status indicators
- Sufficient color contrast
- Reduced motion
- Large enough touch targets

Do not use color alone to communicate:

```text
Completed
Blocked
Overdue
Urgent
```

Use text/icons/status labels as well.

---

# 51. Offline Compatibility

If the Choir App implements the previously planned offline Songs/Repertoire functionality, evaluate whether Tasks should also support offline access.

Potential future offline capabilities:

```text
View assigned tasks
View task details
View comments
Update status
Create pending requests
```

Offline mutations require a synchronization queue and should not be added casually.

For V1, offline task viewing can be considered before offline task mutation.

---

# 52. Performance

The Task system should:

- Avoid fetching all members unnecessarily
- Avoid fetching all tasks on every navigation
- Paginate/virtualize large datasets where appropriate
- Use efficient database queries
- Use indexes based on actual query patterns
- Avoid N+1 queries
- Cache safe read-heavy data
- Use optimistic UI where appropriate
- Avoid unnecessary rerenders
- Lazy-load large task details/attachments when appropriate

---

# 53. Error Recovery

Every important action needs recovery.

Examples:

```text
Task creation failed
→ Retry

Assignment failed
→ Retry

Reassignment approval failed
→ Keep request pending and inform Director

Upload failed
→ Retry upload

Task status update failed
→ Roll back optimistic state
```

Never silently fail.

---

# 54. Recommended Task Lifecycle

The overall workflow should look like:

```text
                DIRECTOR
                    |
                    v
              CREATE TASK
                    |
                    v
              ASSIGN WORK
                    |
                    v
               MEMBER
                    |
          +---------+---------+
          |                   |
          v                   v
     CAN PROCEED          CANNOT PROCEED
          |                   |
          v                   +------> BLOCKED
      IN PROGRESS             |
          |                   +------> REQUEST
          |                            |
          v                            v
      COMPLETED                    DIRECTOR
                                       |
                              +--------+--------+
                              |                 |
                              v                 v
                           APPROVE           REJECT
                              |
                              v
                         REASSIGN
                              |
                              v
                       NEW MEMBER
                              |
                              v
                         IN PROGRESS
                              |
                              v
                          COMPLETED
```

---

# 55. Recommended V1

Do not implement every possible feature at once.

V1 should include:

```text
✓ Main task
✓ Individual responsibilities
✓ Multiple members
✓ Assign to everyone
✓ Individual deadlines
✓ Priority
✓ Member task dashboard
✓ Director task dashboard
✓ Pending/In Progress/Completed
✓ Blocked status
✓ Reassignment request
✓ Director approval/rejection
✓ Assignment history
✓ Basic notifications
✓ Comments
✓ Basic attachments
✓ Search/filter
✓ Responsive UI
✓ Role-based authorization
✓ Supabase RLS/security
```

---

# 56. Recommended V2

After V1 is stable:

```text
○ Deadline extension requests
○ Clarification workflow
○ Task dependencies
○ Recurring tasks
○ Task templates
○ Section/team assignments
○ Advanced analytics
○ Push notifications
○ Email notifications
○ Offline task viewing
○ Offline task mutations
○ Advanced activity timeline
```

---

# 57. UX Patterns To Apply

Use the DesignMotionHQ pattern library as a reference for principles, not as a copy-paste design source.

Reference:
https://www.designmotionhq.com/patterns

Prioritize these patterns:

## Visual

- Visual Hierarchy
- Design Tokens
- Design System Kit
- Color Accessibility
- Grid System
- Proximity Rule
- Shadow Elevation
- Depth Layers
- Dark Mode
- Icon Design Rules

## Navigation

- Navigation Patterns
- Tabs System
- Focus States
- Bottom Sheets
- Pagination

## Feedback

- Loading States System
- Error States
- Empty States
- Notification System
- Toast Notifications
- Optimistic UI
- Undo UX

## Forms

- Form Field States
- Form Validation Timing
- Date Pickers
- File Upload UX
- Stepper/Wizard where appropriate

## Interaction

- Search Experience System
- Data Table
- Modal Hierarchy
- Accordion Disclosure
- Drag and Drop where genuinely useful
- Dropdown Design
- Filter Chips
- Tooltip Design

## Motion

- Animation Timing
- Easing Curves
- Card Hover Anatomy
- Respect reduced motion

Do not force a pattern into the application if the use case does not justify it.

---

# 58. DesignMotionHQ Usage Rule

Do not reproduce the DesignMotionHQ website.

Instead:

```text
DesignMotionHQ principle
        ↓
Understand the UX problem
        ↓
Compare with existing Choir App
        ↓
Adapt to existing design system
        ↓
Implement consistently
```

The Choir App should maintain its own visual identity.

---

# 59. Implementation Rules for Antigravity

Before modifying code:

1. Inspect the existing architecture.
2. Inspect the existing design system.
3. Inspect existing components.
4. Inspect Supabase schema.
5. Inspect RLS.
6. Inspect authentication.
7. Inspect existing notification infrastructure.
8. Inspect responsive behavior.
9. Inspect existing task/member-related features.
10. Identify reusable components.

Do not rewrite working features unnecessarily.

---

# 60. Do Not Create Duplicate Components

Before creating:

```text
TaskCard
TaskModal
TaskDialog
MemberSelector
Notification
DataTable
```

search the repository for existing equivalents.

Reuse or extend existing components where appropriate.

---

# 61. Implementation Gate

For major changes, Antigravity should first produce:

```text
CURRENT ARCHITECTURE
        ↓
UX AUDIT
        ↓
DATA MODEL
        ↓
PERMISSION MODEL
        ↓
UI FLOW
        ↓
IMPLEMENTATION PLAN
        ↓
FILES TO MODIFY
        ↓
FILES TO CREATE
        ↓
DATABASE MIGRATIONS
        ↓
TEST PLAN
```

Then wait for approval before implementing high-impact architectural changes.

---

# 62. Final Target Experience

The finished Choir App should make this workflow feel natural:

```text
DIRECTOR

Create:
"Choir Uniform Preparation"

        ↓

Add responsibilities:

Juan
→ Canvas linen

Maria
→ Design uniform

Carlo
→ Coordinate tailor

Ana
→ Calculate budget

        ↓

MEMBERS WORK

Juan → Completed
Maria → In Progress
Carlo → Blocked
Ana → Completed

        ↓

CARLO CANNOT CONTINUE

Carlo
→ Request Reassignment

        ↓

DIRECTOR

Reviews request

        ↓

Approve

        ↓

NEW MEMBER

Receives assignment

        ↓

COMPLETION

Director sees:

Choir Uniform Preparation
██████████░░ 80%

✓ Canvas linen
✓ Design uniform
✓ Budget
◐ Tailor coordination
```

The system should feel like a **lightweight, purpose-built project/ticket workflow for a choir**, not like a generic enterprise task-management application.

---

# 63. Final UX Principle

The application should always answer:

### For a Member:

> "What am I responsible for, when is it due, and what should I do if I cannot complete it?"

### For a Director:

> "What did I assign, who is responsible, what is blocked, what needs my approval, and what has been completed?"

### For a Super Admin:

> "What is happening across the entire organization, and do I have the authority to intervene?"

If the interface answers those questions quickly and clearly, the task system is succeeding.
