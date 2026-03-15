---
status: pending
priority: p3
issue_id: "030"
tags: [code-review, performance, memory]
dependencies: []
---

# SSE Debounce Timers May Fire After User Disconnects

## Problem Statement

In `sync-events.ts`, the debounced broadcast sets a 1-second timer. If a user disconnects during that window, the timer still fires and tries to broadcast to a disconnected user. The `broadcastToGroupMembers` call will silently fail (no connections found), but the pending event data stays in memory until the timer fires.

## Findings

**Location:** `packages/api/src/services/sync-events.ts:33-47`

The `stopSyncEvents()` function properly clears all timers on shutdown, but individual user disconnects don't clear their pending timers from `pendingEvents`.

**Impact:** Minimal — the broadcast just becomes a no-op. But in a high-churn scenario with many rapid connect/disconnect cycles, the `pendingEvents` map could accumulate entries.

## Proposed Solutions

Clear pending events for a user when they disconnect from SSE. Add a hook in `SSEConnectionManager.removeConnection` that clears the pending debounce.

- **Effort:** Trivial
- **Risk:** None

## Acceptance Criteria

- [ ] Pending events are cleaned up when all connections for a user close
