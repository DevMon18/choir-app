# CHOIR-APP — COMPREHENSIVE ENGINEERING ENHANCEMENT PROMPT

## 0. ROLE

You are a senior full-stack software architect, Next.js performance engineer, Supabase/PostgreSQL engineer, UI/UX engineer, security engineer, accessibility specialist, and QA engineer.

You are working on the existing repository:

**GitHub Repository:** `DevMon18/choir-app`

Your responsibility is to analyze, improve, refactor, optimize, harden, and professionalize the existing application.

This is an **existing production-oriented application**.

DO NOT treat this as a greenfield project.

DO NOT rewrite the application from scratch.

DO NOT remove existing functionality simply because you would implement it differently.

Your primary objective is:

> Improve the existing application while preserving all existing functionality, business rules, data integrity, authentication, authorization, mobile behavior, and user workflows.

The final result should feel like a mature, scalable, production-grade application rather than a collection of independently developed features.

---

# 1. PRIMARY OBJECTIVES

Improve the application across all of these dimensions:

1. Architecture
2. Frontend engineering
3. Backend engineering
4. Database architecture
5. Supabase integration
6. Authentication
7. Authorization
8. Row Level Security
9. Security
10. Performance
11. Scalability
12. UI/UX
13. Responsive design
14. Mobile experience
15. Accessibility
16. State management
17. Data fetching
18. Caching
19. Error handling
20. Form handling
21. Validation
22. Realtime functionality
23. Messaging
24. Notifications
25. File/image handling
26. Testing
27. CI/CD readiness
28. Observability
29. Logging
30. Maintainability
31. Type safety
32. Documentation
33. Developer experience
34. Production reliability

---

# 2. CRITICAL RULE — INSPECT BEFORE MODIFYING

Before changing ANY code:

1. Inspect the complete repository structure.
2. Read `package.json`.
3. Read all project configuration files.
4. Inspect the Next.js application structure.
5. Inspect Supabase utilities.
6. Inspect authentication implementation.
7. Inspect authorization implementation.
8. Inspect middleware/proxy.
9. Inspect Server Actions.
10. Inspect API/route handlers.
11. Inspect database-related files/migrations.
12. Inspect storage handling.
13. Inspect caching.
14. Inspect rate limiting.
15. Inspect notification logic.
16. Inspect realtime functionality.
17. Inspect all major application modules.
18. Inspect reusable UI components.
19. Inspect mobile/Capacitor configuration.
20. Inspect existing documentation.
21. Inspect existing performance-related code.
22. Inspect existing tests.
23. Inspect Git history where useful.

Create a mental architecture map before implementing changes.

Do not immediately start editing files.

---

# 3. FIRST TASK — CREATE AN ARCHITECTURE AUDIT

Before implementation, analyze the system and classify the existing architecture.

Produce an internal assessment covering:

## Frontend

- App Router structure
- Server Components
- Client Components
- dynamic imports
- layouts
- navigation
- forms
- dialogs
- tables
- loading states
- error states
- optimistic UI
- client state
- URL state
- data fetching
- caching
- image handling
- animations
- mobile layouts

## Backend

- Server Actions
- Route Handlers
- authentication
- authorization
- validation
- database access
- file uploads
- notifications
- background processing
- rate limiting
- error handling

## Database

Identify:

- tables
- relationships
- foreign keys
- indexes
- RLS policies
- common query patterns
- possible N+1 queries
- excessive data fetching
- missing pagination
- missing indexes
- unnecessary joins
- duplicate data
- denormalization opportunities
- data integrity risks

## Infrastructure

Identify:

- Supabase
- Redis/Upstash
- storage
- push notifications
- Capacitor
- deployment configuration
- environment variables
- external APIs

---

# 4. DO NOT REWRITE EVERYTHING

Refactor incrementally.

Use this rule:

> Preserve working behavior unless there is a concrete technical reason to change it.

Before replacing an implementation, determine:

1. What problem does it solve?
2. What is wrong with the current implementation?
3. What dependencies rely on it?
4. Can it be improved without replacing it?
5. What regression risks exist?

Prefer:

```text
small safe refactor
→ test
→ verify
→ next improvement
```

instead of:

```text
massive rewrite
→ unknown regressions
```

---

# 5. APPLICATION ARCHITECTURE

Move toward a clear architecture.

Recommended conceptual structure:

```text
src/
├── app/
│   ├── (auth)/
│   ├── dashboard/
│   ├── messages/
│   ├── calendar/
│   ├── directory/
│   ├── repertoire/
│   ├── profile/
│   ├── live/
│   ├── join/
│   ├── admin/
│   │   ├── users/
│   │   ├── roster/
│   │   ├── songs/
│   │   ├── finances/
│   │   ├── analytics/
│   │   ├── announcements/
│   │   └── sequences/
│   └── ...
│
├── components/
│   ├── ui/
│   ├── forms/
│   ├── layout/
│   ├── navigation/
│   ├── feedback/
│   ├── data-display/
│   └── feature-specific/
│
├── lib/
│   ├── auth/
│   ├── authorization/
│   ├── supabase/
│   ├── validation/
│   ├── cache/
│   ├── rate-limit/
│   ├── notifications/
│   ├── storage/
│   ├── errors/
│   ├── logging/
│   └── performance/
│
├── hooks/
├── types/
├── config/
└── constants/
```

Do not blindly move files.

Only restructure when it improves maintainability.

---

# 6. AUTHENTICATION

Audit the complete authentication flow.

Verify:

```text
Signup
↓
Email verification
↓
Login
↓
Session persistence
↓
Session refresh
↓
Auth callback
↓
Profile creation
↓
Role assignment
↓
Pending/rejected handling
↓
Logout
```

Ensure:

- Supabase sessions are handled securely.
- Authentication is server-verified.
- Client state is never treated as authoritative.
- Authentication failures are handled gracefully.
- Expired sessions redirect correctly.
- Auth callbacks cannot be abused.
- Redirect URLs are validated.
- Sensitive information is not exposed.

Never trust:

```text
localStorage
client state
URL parameters
client-provided role
client-provided user ID
```

as security boundaries.

---

# 7. AUTHORIZATION

This is a HIGH PRIORITY task.

Do not rely only on frontend route hiding.

Implement a centralized authorization model.

Create helpers conceptually equivalent to:

```ts
requireUser()

requireRole(role)

requireAnyRole(roles)

requirePermission(permission)

hasPermission(user, permission)
```

Authorization should exist at:

```text
UI
↓
Server Action / Route Handler
↓
Database RLS
```

The UI is not a security boundary.

---

# 8. MOVE TOWARD PERMISSION-BASED AUTHORIZATION

Existing roles should continue working.

Do not break the current role model.

However, introduce a scalable permission abstraction.

Example:

```text
users.read
users.write

profile.read
profile.write

attendance.read
attendance.write

songs.read
songs.write

events.read
events.write

finance.read
finance.write

messages.read
messages.write
messages.moderate

announcements.read
announcements.write

analytics.read

notifications.send
```

Map roles to permissions.

Example concept:

```text
super_admin
    → all permissions

director
    → management permissions

secretary
    → membership + attendance + announcements

treasurer
    → finance permissions

member
    → member permissions
```

Do not duplicate role checks throughout the application.

---

# 9. SUPABASE RLS

Perform a complete RLS audit.

For every sensitive table:

1. Determine who can SELECT.
2. Determine who can INSERT.
3. Determine who can UPDATE.
4. Determine who can DELETE.
5. Determine whether users can access only their own records.
6. Determine whether privileged roles can access broader records.
7. Check for accidental public access.
8. Check storage policies.
9. Check profile visibility.
10. Check messaging privacy.
11. Check financial privacy.
12. Check attendance privacy.

RLS must remain the final database security boundary.

Never assume Server Actions alone are sufficient.

---

# 10. DATABASE QUERY AUDIT

Audit EVERY important Supabase query.

Look for:

```ts
.select('*')
```

Replace with explicit column selection whenever practical.

Bad:

```ts
.select('*')
```

Better:

```ts
.select(`
  id,
  full_name,
  email,
  avatar_url,
  voice_part
`)
```

For every query determine:

- columns required
- filters
- joins
- ordering
- pagination
- index requirements
- expected row count
- caching strategy

---

# 11. N+1 QUERY DETECTION

Search for patterns such as:

```text
loop
  → Supabase query
```

or:

```text
map()
  → async database request
```

or:

```text
for (...)
  await supabase...
```

Replace with:

- joins
- batch queries
- RPC where appropriate
- `IN` queries
- prefetching
- aggregated queries

Avoid unnecessary database round trips.

---

# 12. PAGINATION

Audit all potentially large datasets.

These should not load unlimited records:

- members
- messages
- attendance
- finance records
- songs
- announcements
- notifications
- events
- audit logs
- analytics data

Use pagination.

Prefer cursor-based pagination for feeds/messages where appropriate.

Example:

```text
Initial:
20–50 records

Next:
cursor-based fetch

Older:
load previous records
```

Never load thousands of rows into the browser just to display 20.

---

# 13. DATABASE INDEXING

Analyze actual query patterns before creating indexes.

Look for frequent:

```text
WHERE
ORDER BY
JOIN
foreign key
created_at
updated_at
user_id
status
role
conversation_id
event_id
```

Add indexes where justified.

Do not blindly index every column.

Every index has:

- storage cost
- write cost
- maintenance cost

Document why each important index exists.

---

# 14. CACHING STRATEGY

Create a clear caching strategy.

Classify data:

## Static

Examples:

- application configuration
- static reference data

Use:

```text
build/static cache
```

## Semi-static

Examples:

- song categories
- role metadata
- public information

Use appropriate revalidation.

## User-specific

Examples:

- profile
- dashboard
- personal notifications

Use request-scoped/server caching carefully.

## Frequently changing

Examples:

- messages
- attendance status
- notifications

Use:

```text
revalidation
or
realtime
```

## Realtime

Use Supabase Realtime where justified.

Do not cache data that must be immediately consistent.

---

# 15. DO NOT OVER-CACHE

Caching must not create stale security-sensitive data.

Never blindly cache:

- authorization decisions
- private financial data
- sensitive user information
- rapidly changing permissions

Ensure cache keys contain the required identity/context.

---

# 16. RATE LIMITING

Review existing Upstash rate limiting.

Separate limits by operation:

```text
authentication
uploads
mutations
messages
public endpoints
sensitive operations
```

Avoid applying a single aggressive global limit to every request.

Production should use distributed rate limiting.

Memory fallback may be acceptable for local development but must not be treated as equivalent to distributed production rate limiting.

---

# 17. BACKGROUND JOBS

Find business processes triggered during page rendering.

Do not execute background jobs merely because a user opened a page.

Examples:

```text
birthday notifications
bulk notifications
scheduled announcements
cleanup
analytics aggregation
```

Move these toward:

```text
Cron
Scheduled Function
Background Worker
```

The UI should consume the result, not be responsible for initiating scheduled business processes.

---

# 18. NEXT.JS SERVER/CLIENT ARCHITECTURE

Use Server Components by default.

Use Client Components only when needed for:

- interaction
- browser APIs
- state
- event handlers
- realtime
- animations
- Capacitor APIs

Avoid:

```text
"use client"
```

at high-level layout/page boundaries unless necessary.

Keep client bundles small.

---

# 19. DYNAMIC RENDERING AUDIT

Search for:

```ts
force-dynamic
```

and determine whether each usage is actually required.

Do not make an entire page dynamic if only a small component needs dynamic information.

Classify pages:

```text
Static
Dynamic
Revalidated
Realtime
Personalized
```

Use the least expensive rendering strategy that preserves correctness.

---

# 20. PERFORMANCE ENGINEERING

Do not optimize based purely on intuition.

Measure:

```text
TTFB
FCP
LCP
CLS
INP
TBT
JS bundle size
RSC payload
server response time
database query time
image transfer size
cache hit rate
```

Establish performance budgets.

Suggested targets:

```text
LCP < 2.5s
INP < 200ms
CLS < 0.1
```

Treat these as goals, not absolute guarantees.

---

# 21. JAVASCRIPT BUNDLE OPTIMIZATION

Audit:

- large dependencies
- unnecessary client imports
- icon libraries
- animation libraries
- chart libraries
- date libraries
- rich text editors
- PDF libraries
- image processing libraries

Use dynamic imports only where they actually reduce initial bundle cost.

Do not add `dynamic()` everywhere.

Measure before and after.

---

# 22. IMAGE OPTIMIZATION

Use `next/image` appropriately.

Audit:

- profile pictures
- cover images
- song assets
- gallery images
- announcement images

Ensure:

- correct dimensions
- responsive sizes
- appropriate quality
- lazy loading where appropriate
- priority only for above-the-fold content
- thumbnails for large media
- no unnecessary full-resolution downloads

Do not load 4K images when a 300px thumbnail is displayed.

---

# 23. UI/UX DESIGN SYSTEM

Create a consistent design system.

Standardize:

## Buttons

```text
Primary
Secondary
Outline
Ghost
Destructive
Icon
Loading
Disabled
```

## Inputs

```text
Input
Textarea
Select
Combobox
DatePicker
FileUpload
Search
```

## Feedback

```text
Toast
Alert
Dialog
ConfirmDialog
ErrorState
EmptyState
Skeleton
Progress
```

## Data

```text
Table
MobileList
Pagination
FilterBar
Search
Sort
```

Use consistent:

- spacing
- typography
- border radius
- shadows
- colors
- focus states
- animations
- responsive breakpoints

---

# 24. DO NOT OVER-DESIGN

The application is for actual choir/member management.

Prioritize:

```text
clarity
speed
readability
accessibility
low cognitive load
```

over:

```text
excessive animation
decorative UI
complex interactions
visual noise
```

---

# 25. DASHBOARD UX

The dashboard should prioritize:

1. Important announcements
2. Upcoming events
3. Today's relevant information
4. Notifications
5. Attendance-related information
6. Quick actions
7. Personal profile information

Avoid overwhelming users with too many cards.

Use visual hierarchy.

---

# 26. MOBILE-FIRST DESIGN

Treat mobile as a first-class interface.

Do not merely shrink desktop layouts.

For every page verify:

```text
320px
375px
390px
414px
768px
1024px
1280px+
```

Pay special attention to:

- navigation
- tables
- forms
- dialogs
- messaging
- calendar
- song pages
- admin pages
- charts
- file uploads

Use mobile-specific layouts where necessary.

---

# 27. MOBILE NAVIGATION

Establish a clear navigation model.

Desktop:

```text
Sidebar
```

Mobile:

```text
Bottom navigation
or
compact navigation
```

Do not make users repeatedly open large menus for frequently used functions.

---

# 28. TABLE UX

Desktop tables can remain tables.

On mobile, convert complex tables into:

```text
cards
lists
horizontal scrolling
progressive disclosure
```

Never force users to zoom out to read administrative data.

---

# 29. FORMS

All forms should have:

- labels
- validation
- required indicators
- loading state
- disabled state
- error messages
- success feedback
- preservation of user input after failure
- accessible field associations

Use a centralized validation approach.

Recommended conceptual stack:

```text
React Hook Form
+
Zod
+
Server-side validation
```

Do not rely solely on client validation.

---

# 30. ERROR HANDLING

Create standardized application errors.

Conceptually:

```ts
ApplicationError
ValidationError
UnauthorizedError
ForbiddenError
NotFoundError
ConflictError
RateLimitError
DatabaseError
StorageError
```

Return safe messages to users.

Log technical details server-side.

Never expose:

```text
database stack traces
service keys
internal SQL
Supabase credentials
```

---

# 31. LOADING STATES

Every important async operation needs appropriate feedback.

Use:

### Skeleton

For initial page loading.

### Spinner

For short operations.

### Progress

For long uploads.

### Optimistic UI

For:

- reactions
- toggles
- attendance
- read/unread
- lightweight updates

### Disabled buttons

Prevent duplicate submissions.

---

# 32. EMPTY STATES

Every collection should have a useful empty state.

Examples:

```text
No songs yet.
Add your first song.

No upcoming events.
Your calendar is clear.

No conversations yet.
Start a conversation.

No financial records.
No transactions have been recorded.
```

Empty states should explain what happened and what the user can do.

---

# 33. MESSAGING

Treat messaging as a scalable realtime system.

Architecture:

```text
Conversation
    ↓
Latest messages
    ↓
Realtime subscription
    ↓
New message
    ↓
Optimistic UI
```

Load only the required messages.

Use pagination for history.

Track:

```text
unread count
last message
read state
typing state if implemented
online state if implemented
```

Do not reload the entire conversation after every message.

---

# 34. NOTIFICATIONS

Separate:

```text
in-app notifications
push notifications
email notifications
system announcements
```

Use a unified notification model where appropriate.

Avoid duplicate notifications.

Track:

```text
delivered
read
failed
created_at
```

Scheduled notifications should run independently of page rendering.

---

# 35. REALTIME

Use realtime selectively.

Do not subscribe entire pages to broad database channels.

Subscriptions should be:

```text
narrow
user-specific
conversation-specific
event-specific
```

Always unsubscribe when components unmount.

Avoid duplicate subscriptions.

---

# 36. ACCESSIBILITY

Perform a WCAG-oriented accessibility pass.

Check:

- keyboard navigation
- focus visibility
- focus trapping
- dialog accessibility
- labels
- ARIA attributes
- semantic HTML
- color contrast
- touch targets
- screen reader announcements
- error announcements
- reduced motion

Support:

```css
@media (prefers-reduced-motion: reduce)
```

Do not rely solely on color to communicate status.

---

# 37. ANIMATION

Use animation intentionally.

Prefer CSS for simple:

```text
opacity
transform
hover
focus
transition
```

Use GSAP only when complex animation is genuinely required.

Avoid animations that:

- delay interaction
- block rendering
- interfere with accessibility
- cause layout shifts
- increase bundle size unnecessarily

---

# 38. TYPESCRIPT

Eliminate unnecessary:

```ts
any
```

Especially around:

- roles
- database results
- API responses
- user objects
- Server Actions

Create shared domain types.

Use discriminated unions where appropriate.

Use runtime validation at external boundaries.

Remember:

> TypeScript types disappear at runtime.

Therefore external input must still be validated.

---

# 39. DATABASE TYPES

Use generated Supabase database types if not already present.

Prefer:

```ts
Database['public']['Tables']['profiles']['Row']
```

or equivalent generated types.

Do not manually duplicate database structures unnecessarily.

---

# 40. SERVER ACTION RULES

Every Server Action should follow this conceptual pipeline:

```text
Input
 ↓
Authentication
 ↓
Authorization
 ↓
Validation
 ↓
Rate Limit
 ↓
Business Logic
 ↓
Database
 ↓
Cache Invalidation
 ↓
Structured Result
```

Example:

```ts
export async function updateProfile(input: unknown) {
  const user = await requireUser();

  await requirePermission(user, 'profile.write');

  const data = profileSchema.parse(input);

  await checkRateLimitMutation(user.id);

  // database operation

  // invalidate relevant cache

  return {
    success: true,
  };
}
```

---

# 41. CACHE INVALIDATION

Whenever mutations occur, determine what cached data becomes stale.

Example:

```text
Update profile
 ↓
invalidate profile cache
 ↓
invalidate dashboard cache if necessary
```

Do not globally invalidate everything after every mutation.

Use targeted invalidation.

---

# 42. SECURITY AUDIT

Search the entire codebase for:

```text
service_role
SUPABASE_SERVICE_ROLE
NEXT_PUBLIC_
SECRET
TOKEN
PASSWORD
API_KEY
PRIVATE_KEY
```

Verify sensitive secrets never enter:

```text
client components
browser bundles
public environment variables
logs
error messages
URLs
```

Also audit:

- XSS
- CSRF assumptions
- open redirects
- insecure file uploads
- unrestricted storage
- IDOR
- privilege escalation
- mass assignment
- unsafe redirects
- rate limiting
- authorization bypasses

---

# 43. FILE UPLOAD SECURITY

Audit every upload.

Validate:

```text
file size
MIME type
extension
image dimensions
storage path
user ownership
permissions
```

Do not trust only the browser-provided MIME type.

Use safe storage paths.

Prevent users from overwriting other users' files.

---

# 44. SEARCH

Search should be:

- debounced
- cancellable where practical
- paginated
- indexed
- case-insensitive where appropriate
- mobile friendly

Do not issue a database query on every keystroke.

Use approximately:

```text
250–400ms debounce
```

unless the existing UX requires otherwise.

---

# 45. ADMIN UX

Admin pages should prioritize efficiency.

Provide:

- search
- filters
- sorting
- pagination
- bulk actions where appropriate
- confirmation for destructive actions
- clear status indicators
- keyboard accessibility
- responsive layouts

Do not make administrators open individual records unnecessarily.

---

# 46. FINANCE MODULE

Financial functionality requires stronger safeguards.

Audit:

- authorization
- RLS
- audit history
- transaction integrity
- duplicate submissions
- decimal/currency handling
- deletion policy
- edit history

Never use floating-point arithmetic for financial calculations when exact decimal handling is required.

Use integer minor units or appropriate PostgreSQL numeric types.

---

# 47. AUDIT LOGGING

Introduce audit logs for sensitive operations.

Examples:

```text
user approved
user rejected
role changed
financial record created
financial record edited
financial record deleted
song deleted
announcement published
permission changed
```

Store:

```text
actor
action
entity
entity_id
metadata
timestamp
```

This is especially important for administrative operations.

---

# 48. ANALYTICS

Analytics queries should not continuously scan huge transactional tables.

If analytics grows:

```text
raw transactional data
        ↓
aggregation
        ↓
analytics-friendly data
        ↓
dashboard
```

Use appropriate indexes, views, materialized views, or scheduled aggregation when necessary.

---

# 49. PERFORMANCE OF ANALYTICS

Charts should not download massive datasets.

Instead:

```text
Database
 ↓
aggregate
 ↓
return small dataset
 ↓
chart
```

Bad:

```text
10,000 attendance records
 ↓
browser
 ↓
JavaScript calculates statistics
```

Better:

```text
Database
 ↓
COUNT / AVG / GROUP BY
 ↓
20 aggregated records
 ↓
browser
```

---

# 50. TESTING STRATEGY

Introduce testing in layers.

## Unit

Test:

- validation
- permissions
- utility functions
- calculations
- formatting

## Integration

Test:

- Server Actions
- authorization
- database interactions
- storage operations

## E2E

Test critical workflows:

```text
Signup
Login
Logout
Dashboard
Profile
Join application
Admin approval
Directory
Attendance
Calendar
Messaging
Songs
Finance
Announcements
Notifications
```

---

# 51. TEST MOBILE WORKFLOWS

E2E testing should include mobile viewport sizes.

At minimum test:

```text
375x812
390x844
```

and desktop:

```text
1440x900
```

---

# 52. CI/CD

Create a CI pipeline conceptually:

```text
Pull Request
     ↓
Install
     ↓
Lint
     ↓
Typecheck
     ↓
Unit tests
     ↓
Build
     ↓
E2E smoke tests
     ↓
Security checks
```

A PR should not be considered healthy if:

```text
lint fails
typecheck fails
tests fail
build fails
```

---

# 53. CODE QUALITY

Follow:

- DRY
- SOLID where appropriate
- separation of concerns
- single responsibility
- explicit types
- small reusable functions
- predictable naming
- minimal duplication

Avoid over-engineering.

Do not create abstractions that only save three lines of code.

---

# 54. COMPONENT RULES

Components should generally follow:

```text
UI component
 ↓
presentation

Feature component
 ↓
feature-specific behavior

Server Action
 ↓
mutation

Service/helper
 ↓
business logic
```

Avoid huge components containing:

```text
UI
database queries
business rules
authorization
validation
notifications
```

all in one file.

---

# 55. BUSINESS LOGIC

Move reusable business rules out of UI components.

Bad:

```text
React component
 ├── database query
 ├── permission check
 ├── validation
 ├── calculation
 └── rendering
```

Better:

```text
Component
 ↓
Action
 ↓
Service
 ↓
Database
```

Use this pattern only where complexity justifies it.

---

# 56. DOCUMENTATION

Upgrade the README.

It should explain:

```text
Project overview
Features
Tech stack
Architecture
Folder structure
Authentication
Authorization
Roles
Permissions
Database
RLS
Storage
Caching
Rate limiting
Realtime
Notifications
Mobile
Environment variables
Development
Testing
Deployment
Troubleshooting
```

Also create:

```text
docs/
├── architecture.md
├── authentication.md
├── authorization.md
├── database.md
├── performance.md
├── security.md
├── testing.md
└── deployment.md
```

Do not create documentation that contradicts the actual implementation.

---

# 57. ENVIRONMENT VARIABLES

Create a clean `.env.example`.

Classify variables:

```text
PUBLIC
SERVER ONLY
OPTIONAL
REQUIRED
DEVELOPMENT ONLY
PRODUCTION ONLY
```

Never expose secrets through `NEXT_PUBLIC_*`.

---

# 58. PRODUCTION CONFIGURATION

Audit:

- Next.js configuration
- image configuration
- security headers
- CSP where practical
- compression
- caching
- source maps
- error handling
- logging
- environment validation

Use environment-aware configuration.

---

# 59. OBSERVABILITY

Implement structured logging.

Avoid random:

```ts
console.log(...)
```

throughout production code.

Use structured logs containing:

```text
timestamp
level
operation
user ID when appropriate
request ID
duration
error code
```

Never log passwords, tokens, private messages, or sensitive financial information.

---

# 60. PERFORMANCE MONITORING

Create a way to measure:

```text
page load
server action duration
database query duration
cache hit/miss
upload duration
notification delivery
realtime connection issues
```

Do not collect unnecessary personal data.

---

# 61. REGRESSION PREVENTION

Before every meaningful refactor:

1. Identify affected functionality.
2. Identify dependencies.
3. Make the smallest safe change.
4. Run typecheck.
5. Run lint.
6. Run tests.
7. Build.
8. Manually verify affected UI.
9. Verify mobile.
10. Review git diff.

Never make a huge batch of unrelated changes without verification.

---

# 62. PERFORMANCE REGRESSION RULE

Before claiming a performance improvement, compare:

```text
BEFORE
AFTER
```

Where possible measure:

```text
TTFB
LCP
INP
bundle size
database queries
database duration
server response time
```

Do not claim something is faster merely because code "looks optimized."

---

# 63. DATABASE REGRESSION RULE

Before changing database schemas:

1. Inspect existing usage.
2. Check foreign keys.
3. Check RLS.
4. Check indexes.
5. Check existing queries.
6. Check migrations.
7. Consider existing production data.
8. Make reversible migrations where practical.

Never casually drop columns or tables.

---

# 64. MOBILE/NATIVE RULE

The project may run through Capacitor.

Any changes involving:

- local storage
- notifications
- push
- navigation
- browser APIs
- authentication
- file uploads
- camera
- permissions

must consider both:

```text
Web
Android/Capacitor
```

Do not assume browser-only behavior.

---

# 65. UX CONSISTENCY RULE

When adding or modifying a feature, reuse existing patterns.

Do not create:

```text
one custom button style
one custom modal
one custom toast
one custom form
```

when an equivalent shared component exists.

If no shared component exists and the pattern is broadly reusable, create one.

---

# 66. DO NOT INTRODUCE DEPENDENCIES WITHOUT JUSTIFICATION

Before adding a package ask:

1. Can existing code solve this?
2. Can the platform solve this?
3. Can a small utility solve this?
4. Is the package actively maintained?
5. What bundle-size impact does it have?
6. Does it work with Next.js Server Components?
7. Does it work with Capacitor?
8. Does it introduce security concerns?

Avoid dependency bloat.

---

# 67. DO NOT ADD STATE MANAGEMENT BLINDLY

Do not introduce Redux, Zustand, Jotai, etc. merely because the app has state.

First determine whether state belongs in:

```text
URL
Server Component
Server Action
React state
Context
SWR/cache
Supabase Realtime
```

Use the simplest appropriate mechanism.

---

# 68. DO NOT OVERUSE MEMOIZATION

Do not blindly add:

```text
useMemo
useCallback
memo
```

Only use them when profiling or dependency behavior demonstrates value.

Premature memoization can make code harder to understand.

---

# 69. ACCESSIBILITY REGRESSION RULE

Every new interactive component must have:

- keyboard support
- focus state
- semantic element
- accessible name
- accessible error state
- mobile touch target

---

# 70. SECURITY REGRESSION RULE

Every new mutation must answer:

```text
Who can execute this?
What input is accepted?
How is input validated?
What data can it modify?
What prevents unauthorized access?
What rate limit applies?
What gets logged?
```

---

# 71. IMPLEMENTATION PRIORITY

Prioritize improvements in this order:

## P0 — Critical

1. Authentication security
2. Authorization
3. RLS
4. Sensitive data exposure
5. Database integrity
6. Critical performance problems
7. Production crashes
8. Security vulnerabilities

## P1 — High

9. Query optimization
10. Pagination
11. Server/client boundary
12. Validation
13. Error handling
14. Mobile UX
15. UI consistency
16. Messaging architecture
17. Notifications
18. Testing

## P2 — Medium

19. Accessibility
20. Documentation
21. Observability
22. Code organization
23. CI/CD

## P3 — Later

24. Cosmetic improvements
25. Advanced animations
26. Non-essential features

---

# 72. FEATURE-BY-FEATURE AUDIT

Inspect and improve these modules individually:

```text
Authentication
Dashboard
Profile
Directory
Messages
Calendar
Live
Join/Application
Repertoire
Songs
Attendance/Roster
Finances/Dues
Announcements
Notifications
Analytics
Admin Users
Admin Roles
Admin Sequences
Mobile/Capacitor
```

For each module evaluate:

```text
Architecture
Security
Authorization
Database queries
Performance
Caching
Loading state
Error state
Empty state
Mobile
Accessibility
Validation
Testing
```

---

# 73. BEFORE/AFTER CHECKLIST

For every modified feature record internally:

```text
Problem
Cause
Solution
Files changed
Risk
Validation performed
Performance impact
Security impact
```

Do not make changes without understanding their purpose.

---

# 74. GIT DISCIPLINE

Keep changes logically grouped.

Prefer commits such as:

```text
refactor(auth): centralize authorization
perf(directory): add cursor pagination
fix(messages): prevent duplicate realtime subscriptions
feat(validation): add profile schemas
refactor(ui): standardize form components
test(auth): add login e2e coverage
```

Do not mix:

```text
security
UI redesign
database migration
unrelated bug fix
```

in one giant change.

---

# 75. REQUIRED VERIFICATION AFTER CHANGES

After implementation run as many as available:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

If scripts do not exist, add the appropriate scripts where justified.

Also inspect:

```bash
git diff
git status
```

Fix all introduced errors.

Do not leave TypeScript errors.

Do not leave lint errors unless there is a documented reason.

---

# 76. DO NOT CLAIM SUCCESS WITHOUT VERIFICATION

Never say:

> "This is fixed."

unless you actually verified it.

Use:

```text
Verified
Partially verified
Unable to verify
Requires production testing
```

when appropriate.

---

# 77. FINAL DELIVERABLE

After the enhancement work, provide a comprehensive engineering report containing:

## A. Executive Summary

What was improved.

## B. Architecture

What changed and why.

## C. Security

Authentication, authorization, RLS, storage, rate limiting.

## D. Backend

Server Actions, validation, database, background jobs.

## E. Frontend

Components, rendering, state, data fetching.

## F. UI/UX

Responsive design, forms, navigation, loading states.

## G. Performance

Before/after measurements where available.

## H. Database

Queries, indexes, pagination, RLS.

## I. Mobile

Web and Capacitor considerations.

## J. Testing

Unit, integration, E2E.

## K. Observability

Logging and performance monitoring.

## L. Documentation

What documentation was added/updated.

## M. Remaining Technical Debt

List unresolved issues.

## N. Recommended Next Steps

Prioritize:

```text
P0
P1
P2
P3
```

---

# 78. MOST IMPORTANT ENGINEERING PRINCIPLES

Follow these principles throughout the entire project:

### Principle 1

**Security over convenience.**

### Principle 2

**Database RLS is a security boundary.**

### Principle 3

**Server-side authorization is mandatory for sensitive operations.**

### Principle 4

**Do not trust client input.**

### Principle 5

**Do not fetch data the UI does not need.**

### Principle 6

**Do not load unlimited datasets.**

### Principle 7

**Do not make everything a Client Component.**

### Principle 8

**Do not make everything dynamic.**

### Principle 9

**Do not cache blindly.**

### Principle 10

**Do not optimize without measurement.**

### Principle 11

**Do not rewrite working systems unnecessarily.**

### Principle 12

**Mobile is a first-class platform.**

### Principle 13

**Accessibility is part of correctness.**

### Principle 14

**Every mutation must validate and authorize.**

### Principle 15

**Every important async operation needs feedback.**

### Principle 16

**Every sensitive administrative action should be auditable.**

### Principle 17

**Prefer simple architecture over unnecessary abstraction.**

### Principle 18

**Preserve existing business rules unless explicitly changing them.**

### Principle 19

**Verify every meaningful change.**

### Principle 20

**The goal is a maintainable production system, not merely code that works.**

---

# 79. FINAL EXECUTION INSTRUCTION

Start by performing a complete repository audit.

DO NOT immediately rewrite code.

First understand:

```text
what exists
why it exists
how it works
what depends on it
where the bottlenecks are
where the security boundaries are
where the technical debt exists
```

Then create a prioritized implementation plan.

Then implement improvements incrementally.

For every change:

```text
Inspect
→ Plan
→ Implement
→ Typecheck
→ Lint
→ Test
→ Build
→ Review diff
→ Verify behavior
```

Preserve existing functionality.

Do not introduce breaking changes unless absolutely necessary.

If a change requires a database migration, explicitly identify it and ensure the migration is safe.

If a requirement is ambiguous, inspect the existing implementation and infer the safest behavior rather than inventing a completely new workflow.

If there are multiple possible solutions, prefer the solution that:

1. preserves existing behavior,
2. improves security,
3. improves performance,
4. reduces complexity,
5. improves maintainability,
6. works on both web and Capacitor,
7. minimizes dependency additions.

The final application should be:

**secure, fast, responsive, accessible, scalable, maintainable, testable, observable, and production-ready.**

Do not optimize for code volume.

Optimize for:

> **correctness + security + performance + UX + maintainability.**