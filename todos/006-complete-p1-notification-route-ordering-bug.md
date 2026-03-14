---
status: pending
priority: p1
issue_id: "006"
tags: [code-review, quality]
dependencies: []
---

# Notification route ordering bug: PUT /read-all is unreachable

## Problem Statement

In `notifications.ts`, `PUT /:id/read` (line 30) is registered before `PUT /read-all` (line 49). Express matches routes top-down, so `/read-all` matches `/:id/read` with `id="read-all"` — the `read-all` endpoint is never reached.

**Why it matters:** The "Mark all as read" feature in NotificationBell.tsx silently fails — the API tries to find a notification with id `"read-all"`, returns 404, and the user's notifications stay unread.

## Findings

- **Location:** `packages/api/src/routes/notifications.ts:30,49`
- `PUT /:id/read` on line 30 matches first
- `PUT /read-all` on line 49 is shadowed
- Express route matching is order-dependent

## Proposed Solutions

### Option A: Move /read-all before /:id/read
- **Pros:** One line move, fixes the bug
- **Cons:** None
- **Effort:** Small
- **Risk:** Low

## Recommended Action

Option A — reorder the routes so `/read-all` comes before `/:id/read`.

## Technical Details

- **Affected files:** `packages/api/src/routes/notifications.ts`

## Acceptance Criteria

- [ ] PUT /api/notifications/read-all returns 200 and marks all notifications as read
- [ ] PUT /api/notifications/:id/read still works for individual notifications
- [ ] NotificationBell "Mark all read" functions correctly

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Finding created from code review | TypeScript reviewer flagged |

## Resources

- File: `packages/api/src/routes/notifications.ts:30,49`
