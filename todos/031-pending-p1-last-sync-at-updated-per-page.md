---
status: complete
priority: p1
issue_id: "031"
tags: [code-review, logic-error, sync]
dependencies: []
---

# lastSyncAt Updated After Every Pagination Page, Not Just Final Page

## Problem Statement

In `sync-worker.ts`, `lastSyncAt` is updated to `new Date()` after EVERY page of the sync list pagination. When a sync fetches 200 activities and spawns a follow-up page, the first page already updates `lastSyncAt` to "now" — meaning if the second page fails, the activities from the gap between the real last sync and "now" will be permanently skipped.

## Findings

**Location:** `packages/api/src/queues/sync-worker.ts:80-84`

```typescript
// This runs on EVERY page, including intermediate ones
await prisma.user.update({
  where: { id: userId },
  data: { lastSyncAt: new Date() },
});
```

When `activities.length === 200`, a follow-up page is queued (line 68-75), but `lastSyncAt` was already updated on the current page. If page 2 fails after 3 retries, those activities are lost.

## Proposed Solutions

### Solution 1: Only update lastSyncAt on the final page (Recommended)
```typescript
if (activities.length < 200) {
  await prisma.user.update({
    where: { id: userId },
    data: { lastSyncAt: new Date() },
  });
}
```
- **Effort:** Trivial
- **Risk:** Low

## Acceptance Criteria

- [x] `lastSyncAt` only updated when sync pagination is complete (no more pages)
- [x] Failed intermediate pages don't cause data gaps
