# 24. CRITICAL FEATURE — Director/Admin Live Song Control

## Objective

The Live Sync system must support **centralized control of the currently active song during a live performance**.

Currently, the Live Sync experience should not assume that the active song can only be changed through each user's local navigation.

There are real performance situations where the Director/Admin needs to change the current song for everyone.

Example:

```text
Director/Admin
        ↓
Live Sync Control
        ↓
Changes current song
        ↓
Shared Live Session State
        ↓
Realtime Update
        ↓
All connected Live Sync clients
        ↓
Display new active song
```

---

# 25. Global vs Local Song State

Before implementation, inspect the existing Live Sync state architecture.

Determine whether the current active song is:

```text
Local client state
```

or:

```text
Shared/session state
```

or:

```text
Database-backed state
```

or:

```text
Realtime state
```

Do not assume.

The system should distinguish between:

### Global Live Song

The song currently being performed/presented by the Director.

### Local UI State

Non-global preferences such as:

* Font size
* Chord visibility
* Formatting preferences
* Display settings

A member changing a local display preference should not change the global song.

---

# 26. Director/Admin Change Current Song

Director/Super Admin should have an obvious control for changing the currently active song during Live Sync.

Possible UI:

```text
LIVE SYNC

Current:
Amazing Grace

[ Change Song ]
```

or:

```text
[ < Prev ] [ Amazing Grace ▼ ] [ Next > ]
```

The implementation should determine the best UI based on the existing Live Sync architecture.

The important requirement is:

> **Director/Super Admin must be able to change the global active song at any time during a live session.**

---

# 27. Global Live Session State

If the existing architecture does not already provide a shared active-song state, design an appropriate mechanism.

Conceptually:

```text
live_session
    |
    ├── active_song_id
    ├── active_setlist_id
    ├── status
    ├── changed_by
    ├── changed_at
    └── session_id
```

The exact schema must be determined after inspecting the existing database.

Do not automatically create a new table if an existing setlist/live-session structure can safely support this functionality.

---

# 28. Realtime Synchronization

When the Director changes the active song:

```text
Director
    ↓
Update authoritative state
    ↓
Realtime event
    ↓
Connected clients
    ↓
Update active song
    ↓
Load/render lyrics
    ↓
Load/render chords
    ↓
Update Next Up
```

The implementation must avoid requiring every member to manually refresh the page.

---

# 29. Member Experience

When the Director changes the active song:

```text
Director:
Amazing Grace
        ↓
changes to
        ↓
How Great Thou Art
```

Connected members should automatically see:

```text
How Great Thou Art
```

without refreshing.

The transition should be clear but not distracting.

Avoid excessive animations during a performance.

---

# 30. Member Local Navigation

Determine whether members should be allowed to browse songs independently.

Recommended model:

### Director

Controls the **global live song**.

### Member

Can optionally browse ahead/preview songs without changing the global live song.

For example:

```text
GLOBAL LIVE SONG
How Great Thou Art

Member is previewing:
Amazing Grace
```

The UI should clearly distinguish:

```text
LIVE NOW
```

from:

```text
PREVIEW
```

This prevents a member accidentally changing what everyone sees.

If the existing application intends members to control the live song themselves, preserve that behavior only if it is explicitly part of the current role model.

---

# 31. Permission Model

Recommended:

| Action                       |   Member | Director | Super Admin |
| ---------------------------- | -------: | -------: | ----------: |
| View current live song       |      YES |      YES |         YES |
| Change global live song      |       NO |      YES |         YES |
| Navigate global song         |       NO |      YES |         YES |
| Preview another song         | Optional |      YES |         YES |
| Change chord display locally |      YES |      YES |         YES |
| End live session             |       NO |      YES |         YES |

Do not rely solely on hiding buttons.

The backend/database must enforce authorization.

---

# 32. Realtime Conflict Handling

Consider what happens if:

```text
Director A
changes song → Song A

Director B
changes song → Song B
```

Define a deterministic rule.

Possible approach:

```text
Latest authorized update wins.
```

The authoritative server/database state should determine the final result.

Do not allow clients to maintain conflicting global active-song states.

---

# 33. Late Joiners

A member may open Live Sync after the performance has already started.

Example:

```text
Performance started

Current song:
Amazing Grace

Director changes to:
How Great Thou Art

Member opens Live Sync
```

The new member should receive:

```text
How Great Thou Art
```

rather than an outdated/default song.

The authoritative current live state must be loaded when the client joins.

---

# 34. Connection Loss

If a member temporarily loses connectivity:

```text
CONNECTED
    ↓
DISCONNECTED
    ↓
Shows last known song
    ↓
RECONNECTING
    ↓
Fetch authoritative current state
    ↓
Synchronize
```

Do not immediately display an unrelated/default song merely because realtime connectivity was lost.

Provide an unobtrusive connection indicator where appropriate.

---

# 35. Race Conditions

Protect against:

```text
Song changes rapidly
```

Example:

```text
Song A
→ Song B
→ Song C
```

The UI should not end up showing:

```text
Song C title
+
Song B lyrics
+
Song A chords
```

Use a consistent active-song identity when loading dependent data.

Conceptually:

```text
activeSongId
    ↓
lyrics for activeSongId
    ↓
chords for activeSongId
```

If the active song changes while data is loading, stale responses must not overwrite the newer song.

---

# 36. Loading During Live Song Changes

When changing the active song:

```text
Current Song
      ↓
New Song selected
      ↓
Lyrics loading
      ↓
Lyrics loaded
```

Avoid displaying mismatched content.

Prefer a controlled transition such as:

```text
How Great Thou Art

Loading lyrics...
```

rather than:

```text
How Great Thou Art

[old song lyrics]
```

---

# 37. Optimistic UI

Evaluate whether changing the live song should use optimistic UI.

If the Director selects a song:

```text
Director selects Song B
        ↓
UI immediately indicates Song B
        ↓
Server/database update
        ↓
Success → keep Song B
Failure → rollback and notify Director
```

Only use optimistic behavior if rollback and synchronization can be implemented safely.

For a live-performance-critical action, correctness is more important than perceived speed.

---

# 38. Live Change Confirmation

Do not add confirmation dialogs to every song change if that would slow down live operation.

Instead, consider:

```text
[ Change Song ]
```

with immediate visual confirmation:

```text
✓ Live song changed to "How Great Thou Art"
```

However, if changing songs has potentially destructive consequences in the existing architecture, evaluate whether confirmation is justified.

---

# 39. Current Live Indicator

The UI should clearly distinguish the globally active song.

Example:

```text
● LIVE NOW

How Great Thou Art
```

A member previewing another song should see:

```text
LIVE NOW
How Great Thou Art

PREVIEW
Amazing Grace
```

This prevents confusion during performances.

---

# 40. Next Up Synchronization

When the Director changes the active song, verify that:

```text
Current Song
Next Up
Setlist position
Navigation state
```

remain consistent.

Example:

```text
Setlist:

1. Opening Song
2. Amazing Grace
3. How Great Thou Art
4. Closing Song
```

If Director changes:

```text
Current:
Amazing Grace
```

to:

```text
How Great Thou Art
```

the system should correctly determine:

```text
Previous → Amazing Grace
Current → How Great Thou Art
Next → Closing Song
```

according to the actual setlist order.

Do not derive Next Up from stale local state.

---

# 41. Audit Trail

Because the Director is controlling a shared live state, consider recording:

```text
Live Song Change

Changed by:
Director Name

From:
Amazing Grace

To:
How Great Thou Art

Time:
10:42 PM
```

This can be useful for debugging and accountability.

Use an existing activity/audit mechanism if one already exists.

Do not introduce unnecessary persistent logging if the application does not need it.

---

# 42. Backend Requirements

The global active song must have an authoritative source.

The implementation must prevent unauthorized clients from changing it.

Backend/database rules should enforce:

```text
Member:
READ current live state

Director:
READ + UPDATE current live state

Super Admin:
READ + UPDATE current live state
```

The exact permissions must match the existing Choir App role model.

---

# 43. Testing Requirements

Test at minimum:

### Single Director

```text
Director changes Song A → Song B
```

All connected clients update.

### Multiple Members

```text
Director changes song
→ all connected members update
```

### Late Joiner

```text
Director changes song
→ new member joins
→ sees current song
```

### Member Restriction

```text
Member attempts to change global song
→ rejected
```

### Connection Loss

```text
Member disconnects
→ reconnects
→ receives authoritative current song
```

### Rapid Changes

```text
Song A → B → C
```

Final state must be Song C with matching lyrics/chords.

### Missing Chords

```text
Director changes to song without chords
```

Chord control updates correctly.

### Realtime Failure

Verify that the application does not falsely report that all clients are synchronized when realtime delivery fails.

---

# 44. Critical Principle

The Live Sync page should not be designed as:

```text
Each user independently selects a song
```

when the goal is a coordinated live performance.

Instead, the architecture should conceptually support:

```text
                LIVE SESSION
                     │
                     │
              ACTIVE SONG
                     │
          ┌──────────┼──────────┐
          ↓          ↓          ↓
       Director    Member     Member
          │          │          │
          │       Display      Display
          │       current      current
          │        song          song
          │
       Can change
       global song
```

The Director/Super Admin controls the authoritative live song.

Members receive the synchronized state.

Members may optionally preview other songs without changing the global live state, provided this is compatible with the existing product requirements.

---

# 45. Final Implementation Rule

Before implementing this feature:

1. Inspect the current Live Sync architecture.
2. Identify the current source of active-song state.
3. Inspect Supabase tables and relationships.
4. Inspect existing realtime subscriptions.
5. Inspect role/RLS policies.
6. Determine whether an existing session/setlist state can be reused.
7. Avoid creating duplicate sources of truth.
8. Design the smallest reliable architecture that supports shared live song control.
9. Implement the UI.
10. Test synchronization with multiple clients.
11. Test reconnect behavior.
12. Test authorization.
13. Test rapid song changes.
14. Verify lyrics/chords cannot become mismatched.
15. Verify Next Up remains synchronized.

Do not treat this as merely a dropdown/button enhancement.

It is a **shared Live Session state-management feature** and must be implemented accordingly.
