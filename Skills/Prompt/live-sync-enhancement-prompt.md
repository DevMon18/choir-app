# Live Sync UX/UI Audit & Enhancement — Implementation Task

## Objective

Improve the Choir App's **Live Sync** view based on the provided reference screenshot `image_edcd02.png`.

The primary goal is to make Live Sync:

* Faster to understand
* Less visually redundant
* More space-efficient
* Easier to operate during a choir performance
* Responsive across desktop, tablet, and mobile
* Accessible
* Performant
* Consistent with the existing Choir App design system

This is a **targeted UX/UI enhancement**, not a request to rewrite the Live Sync architecture.

---

# IMPORTANT: AUDIT BEFORE IMPLEMENTATION

Before changing code, inspect the existing implementation and determine:

1. Which component renders the Live Sync page.
2. How the active song is selected.
3. How Prev/Next navigation works.
4. How the setlist is loaded.
5. How lyrics are loaded.
6. How chords are loaded.
7. How formatting/chord visibility is stored.
8. How the "Live" state is represented.
9. Whether Live Sync uses realtime subscriptions.
10. How "Next Up" data is generated.
11. Where duplicate repertoire/setlist tags originate.
12. Existing responsive behavior.
13. Existing UI/design-system components.
14. Existing loading/error/empty states.
15. Existing authorization rules.
16. Existing performance optimizations.

Do not modify architecture unnecessarily.

Reuse existing components, hooks, services, utilities, and design tokens whenever appropriate.

---

# 1. Setlist Navigation

Current issue:

The Prev and Next controls are vertically separated from the song selector.

Current conceptual layout:

```text
Prev

Song Dropdown

Next
```

Improve the layout to establish an obvious backward/current/forward relationship.

Preferred desktop pattern:

```text
[ < Prev ] [ Current Song ▼ ] [ Next > ]
```

Requirements:

* Prev, selector, and Next should visually belong to the same navigation group.
* Maintain clear spacing.
* Buttons must have appropriate touch targets.
* The current song must remain visually dominant.
* Do not unnecessarily increase the navigation group's height.
* Preserve the existing song-selection functionality.

Audit and implement appropriate responsive behavior.

On narrow screens, do not force the desktop layout if it causes crowding. Determine the most usable mobile arrangement.

---

# 2. Prev/Next State Handling

Audit existing navigation behavior.

Handle:

* First song
* Last song
* Empty setlist
* Single-song setlist
* Loading state
* Missing/invalid active song

Determine whether the existing application intentionally wraps navigation.

If wrapping is not already part of the intended behavior, use:

```text
First song:
Prev disabled

Last song:
Next disabled
```

Do not invent a new navigation behavior without inspecting the current application logic.

When changing songs, ensure the existing:

* Active song state
* Lyrics
* Chords
* Next Up
* Setlist state
* URL/state synchronization, if present
* Realtime behavior

remain correct.

---

# 3. Consolidate Chord Controls

Current issue:

The interface exposes chord visibility through redundant controls such as:

```text
Chords: On
```

and:

```text
Show Chords
```

Do not maintain two controls representing the same state.

Audit the existing chord state architecture and consolidate it into a single clear control.

The final control should communicate:

* Whether chords are currently visible
* That the control is interactive
* Whether chords are available for the active song

Use the existing component/design system where possible.

---

# 4. Chord Availability State

Do not determine chord availability from an incomplete/loading state.

Explicitly distinguish:

```text
LOADING
HAS_CHORDS
NO_CHORDS
ERROR
```

Behavior:

### HAS_CHORDS

Show the chord visibility control.

### NO_CHORDS

Disable or hide the chord visibility control according to the existing design system.

The user should not be presented with an active-looking chord control when the selected song has no chord data.

### LOADING

Do not prematurely hide the control simply because chord data has not arrived yet.

### ERROR

Use an appropriate non-blocking error state if chord data fails to load.

Do not break lyric rendering because chord data is unavailable.

---

# 5. Active Song Container

Current issue:

The Song Title, Formatting Toolbar, and Lyrics are visually fragmented into separate white cards.

Improve the hierarchy so that the controls and content they operate on feel like one cohesive "Active Song" experience.

Preferred conceptual hierarchy:

```text
ACTIVE SONG
────────────────────────────

Song title / metadata

Navigation / formatting controls

Lyrics / chords
```

Do not create an unnecessarily large nested card structure.

The objective is to reduce wasted vertical space while preserving clear hierarchy.

The lyrics should remain the primary content.

Controls should feel associated with the content they manipulate.

---

# 6. Performance Mode UX

Treat Live Sync as a performance-oriented screen.

Prioritize:

1. Readability
2. Fast recognition
3. Minimal distraction
4. Predictable navigation
5. Large enough touch targets
6. Clear current-song identification
7. Minimal unnecessary scrolling

Audit:

* Lyrics font size
* Line height
* Content width
* Contrast
* Control density
* Button size
* Scroll behavior
* Current-song visibility
* Next-song visibility
* Mobile landscape experience
* Tablet landscape experience

Do not sacrifice readability simply to fit more content.

---

# 7. Duplicate "Next Up" Tags

The "Next Up" area currently displays duplicate values such as:

```text
MEMORIAL ACCLAMATION
MEMORIAL ACCLAMATION
```

Do not immediately assume this is purely a rendering issue.

First trace the data flow:

```text
Database
 ↓
Query
 ↓
Transformation
 ↓
State
 ↓
Component
 ↓
Rendering
```

Determine where duplicates originate.

If duplicate values are legitimate database results but should not be displayed repeatedly, deduplicate the values before rendering.

Use stable, deterministic deduplication.

Do not silently remove meaningful duplicate records if duplicates represent distinct entities.

If the root cause is an incorrect query or data transformation, fix the root cause instead of relying only on a presentation-layer patch.

---

# 8. "Live" Indicator

The current Live indicator appears awkwardly positioned in the top navigation.

Audit what the Live indicator semantically represents.

Determine whether it means:

* Live Sync mode is active
* Realtime connection is active
* A performance/presentation session is active
* Something else in the existing application

Based on its meaning and the existing navigation architecture, determine the most appropriate placement.

Possible solutions include:

```text
Top-right status area
```

or:

```text
Integrated into the active Live Sync navigation item
```

Do not arbitrarily move it without understanding its semantic purpose.

If it represents realtime connection state, consider appropriate states such as:

```text
Connected
Reconnecting
Disconnected
```

Do not represent a disconnected realtime state as simply "Live."

---

# 9. Responsive Design

Audit all Live Sync layouts at:

* Desktop
* Laptop
* Tablet portrait
* Tablet landscape
* Mobile portrait
* Mobile landscape

Do not simply shrink the desktop layout.

Ensure:

* Navigation remains usable
* Dropdown remains readable
* Lyrics remain readable
* Buttons remain touch-friendly
* Formatting controls do not overflow
* No horizontal scrolling occurs unintentionally
* Long song titles are handled gracefully
* Long lyrics do not break the layout

---

# 10. Accessibility

Ensure:

* Semantic buttons are used for actions.
* Dropdowns have accessible labels.
* Keyboard navigation works.
* Focus states are visible.
* Disabled controls are semantically disabled.
* Chord state is communicated to assistive technology.
* Color is not the only indicator of state.
* Touch targets are sufficiently large.
* Contrast remains accessible.
* Reduced-motion preferences are respected.

Do not remove focus indicators merely for visual cleanliness.

---

# 11. Loading States

Audit loading behavior for:

* Setlist
* Active song
* Lyrics
* Chords
* Next Up
* Realtime connection

Use appropriate loading patterns.

Avoid replacing the entire page with a spinner when only the active song is changing.

Where safe, preserve already-visible content while new data loads.

---

# 12. Empty States

Handle:

### Empty setlist

```text
No songs in this setlist.
```

### Missing lyrics

```text
Lyrics aren't available for this song.
```

### Missing chords

```text
No chord information is available for this song.
```

### Missing Next Up

Use an appropriate minimal empty state rather than leaving unexplained blank space.

---

# 13. Error Handling

Ensure failures are recoverable.

Examples:

```text
Unable to load song
[Retry]
```

```text
Realtime connection interrupted
[Reconnect]
```

Do not expose raw database/API errors to normal users.

Do not allow chord failures to prevent lyrics from being displayed.

---

# 14. Performance Audit

Before implementation, inspect:

* Number of network requests during song switching
* Setlist query behavior
* Song query behavior
* Lyrics/chord query behavior
* Realtime subscriptions
* React/component rerenders
* Expensive transformations
* Duplicate queries
* Unnecessary refetching
* Large lyric rendering
* Attachment/media loading if applicable

Avoid patterns such as:

```text
Click Next
 ↓
Refetch entire application
 ↓
Refetch entire setlist
 ↓
Refetch all songs
 ↓
Rerender everything
```

Prefer targeted updates where the existing architecture supports them.

Do not introduce unnecessary caching or state complexity without evidence.

---

# 15. Realtime/Live Sync Safety

If Live Sync uses realtime subscriptions:

* Do not create duplicate subscriptions.
* Clean up subscriptions correctly.
* Prevent memory leaks.
* Handle reconnects.
* Handle disconnects.
* Avoid unnecessary subscription recreation when changing songs.
* Preserve existing realtime behavior unless a bug is found.

If no realtime mechanism currently exists, do not introduce one as part of this UI-only enhancement unless explicitly required.

---

# 16. Security and Permissions

Do not weaken existing authorization.

Inspect whether Live Sync functionality has role-based restrictions.

Do not move security checks entirely to the frontend.

If UI controls are hidden based on role, backend/database authorization must still remain authoritative.

---

# 17. Component Reuse

Before creating new components, search for existing:

* Buttons
* Select/dropdown
* Toggle
* Toolbar
* Badge
* Card
* Dialog
* Tooltip
* Skeleton
* Empty state
* Error state

Reuse existing components where appropriate.

Do not create duplicate versions of components already provided by the application's design system.

---

# 18. Scope Control

This task is primarily a:

```text
UX/UI
+
Responsive
+
Accessibility
+
Performance audit
```

Do not rewrite unrelated parts of the application.

Do not:

* Replace the framework
* Replace the component library
* Rewrite authentication
* Rewrite Supabase integration
* Rewrite routing
* Rewrite the entire Live Sync architecture
* Change unrelated pages

unless inspection proves that an existing implementation is directly responsible for the identified issue.

---

# 19. Validation Requirements

After implementation, verify:

### Navigation

* Prev works.
* Next works.
* Dropdown works.
* First/last states work.
* Single-song setlist works.

### Chords

* One chord control exists.
* Songs with chords display the control.
* Songs without chords don't present a misleading active control.
* Lyrics continue working without chords.

### Next Up

* Duplicate values are not rendered unnecessarily.
* Legitimate distinct entries remain intact.

### Responsive

Test desktop, tablet, mobile portrait, and mobile landscape.

### Accessibility

Test keyboard navigation, focus, labels, and disabled states.

### Performance

Compare song switching before and after the changes.

### Realtime

Verify connection/disconnection behavior if applicable.

### Regression

Verify that existing:

* Setlist behavior
* Song selection
* Lyrics
* Chords
* Navigation
* Next Up
* Permissions
* Realtime behavior

remain functional.

---

# 20. Implementation Process

Follow this order:

```text
1. Inspect existing Live Sync implementation
        ↓
2. Trace data flow
        ↓
3. Identify existing reusable components
        ↓
4. Identify actual root causes
        ↓
5. Produce implementation plan
        ↓
6. Implement targeted changes
        ↓
7. Run lint/type checks
        ↓
8. Run relevant tests
        ↓
9. Manually verify responsive layouts
        ↓
10. Verify accessibility
        ↓
11. Verify performance
        ↓
12. Report changed files and findings
```

Before making architectural changes, explain why the change is necessary.

---

# 21. Final Expected UX

The target desktop hierarchy should approximately communicate:

```text
┌───────────────────────────────────────────────┐
│ Choir App                         ● Live      │
├───────────────────────────────────────────────┤
│                                               │
│ ACTIVE SONG                                   │
│                                               │
│ [ < Prev ] [ Current Song ▼ ] [ Next > ]      │
│                                               │
│ Song Title                                    │
│ Formatting / Chord Controls                  │
│                                               │
│ ────────────────────────────────────────────  │
│                                               │
│ Lyrics                                        │
│                                               │
│ Lyrics                                        │
│                                               │
│ Lyrics                                        │
│                                               │
└───────────────────────────────────────────────┘
```

The exact visual implementation should follow the existing Choir App design system.

The goal is not to reproduce this ASCII layout literally.

The goal is to achieve:

* Clear hierarchy
* Reduced redundancy
* Efficient vertical space
* Fast song navigation
* Clear chord state
* Readable lyrics
* Minimal distraction
* Strong mobile usability
* Reliable Live Sync behavior

---

# 22. Reference UX Principles

Use the following UX pattern categories as reference when evaluating the implementation:

DesignMotionHQ Pattern Library:

https://www.designmotionhq.com/patterns

Relevant principles include:

* Visual Hierarchy
* Navigation Patterns
* Search Experience
* Loading States
* Empty States
* Error States
* Notification System
* Toast Notifications
* Optimistic UI
* Form Field States
* Modal Hierarchy
* Bottom Sheets
* Tabs
* Accordion Disclosure
* Focus States
* Color Accessibility
* Design Tokens
* Dark Mode
* Data Tables
* Animation Timing
* Reduced Motion

Use these as **UX principles**, not as instructions to copy another website.

---

# 23. Required Final Report

After implementation, provide a concise report containing:

```text
## Changes Made

## Root Causes Found

## Files Modified

## Components Reused

## Database/API Changes
(if any)

## Performance Impact

## Accessibility Improvements

## Responsive Improvements

## Tests Performed

## Remaining Issues

## Recommended Future Improvements
```

Do not claim that something was tested if it was not actually tested.

# Final Instruction

Before changing code, inspect the existing Choir App implementation and audit the requested changes against the actual architecture.

Do not blindly implement the screenshot-based instructions.

If the requested UI change conflicts with existing functionality, identify the conflict first and propose the safest implementation.

Preserve existing behavior unless the requested change explicitly requires modifying it.
