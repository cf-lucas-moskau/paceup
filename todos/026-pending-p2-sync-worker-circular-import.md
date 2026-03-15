---
status: pending
priority: p2
issue_id: "026"
tags: [code-review, architecture]
dependencies: []
---

# Sync Worker Uses Dynamic Import to Avoid Circular Dependency

## Problem Statement

`sync-worker.ts` uses `await import('./index.js')` inside the worker callback to get `syncListQueue`, because importing it at the top level would create a circular dependency (`index.ts` exports queues, `sync-worker.ts` imports queues and is imported by `index.ts`).

## Findings

**Location:** `packages/api/src/queues/sync-worker.ts:69`

```typescript
if (activities.length === 200) {
  const { syncListQueue } = await import('./index.js');
  await syncListQueue.add(...);
}
```

This works but is a code smell indicating the module structure needs adjustment.

## Proposed Solutions

### Solution 1: Extract queue instances to a separate module (Recommended)
Move queue creation to `queues/queues.ts`, have both `index.ts` and `sync-worker.ts` import from it.
- **Effort:** Small
- **Risk:** Low

### Solution 2: Pass queue as parameter to worker factory
```typescript
function processSyncWorker(syncListQueue: Queue) { ... }
```
- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] No dynamic imports in worker files
- [ ] No circular dependencies
