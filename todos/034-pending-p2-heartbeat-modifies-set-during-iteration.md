---
status: pending
priority: p2
issue_id: "034"
tags: [code-review, quality, correctness]
dependencies: []
---

# SSE Heartbeat Modifies Connection Set During Iteration

## Problem Statement

In `SSEConnectionManager.heartbeat()`, when a JWT verification fails, `removeConnection()` is called while iterating over the `Set<Connection>`. While JS Set iteration tolerates deletions per spec, the outer Map iteration may also be affected if `removeConnection` empties a user's set and deletes the Map entry.

## Findings

**Location:** `packages/api/src/services/sync-status.ts:127-148`

```typescript
for (const [userId, conns] of this.connections) {
  for (const conn of conns) {
    // ...
    this.removeConnection(userId, conn); // Modifies the Set AND potentially the Map
    continue;
  }
}
```

## Proposed Solutions

Collect connections to remove in an array, then remove after iteration:
```typescript
const toRemove: [string, Connection][] = [];
for (const [userId, conns] of this.connections) {
  for (const conn of conns) {
    if (shouldRemove) toRemove.push([userId, conn]);
  }
}
for (const [userId, conn] of toRemove) {
  this.removeConnection(userId, conn);
}
```
- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] No collection mutation during iteration in heartbeat
