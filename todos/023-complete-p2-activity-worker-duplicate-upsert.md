---
status: pending
priority: p2
issue_id: "023"
tags: [code-review, quality, simplification]
dependencies: []
---

# Activity worker: duplicated upsert data + unnecessary re-query

## Problem Statement

In `activity-worker.ts`, the `prisma.activity.upsert` call has identical `update` and `create` data blocks (~24 duplicated lines). After the upsert, a separate `findUnique` query fetches the ID — but the upsert already returns it.

## Findings

- **Location:** `packages/api/src/queues/activity-worker.ts:18-75`
- `update` and `create` objects are field-for-field identical
- Re-query after upsert is wasteful (lines 69-75)

## Proposed Solutions

### Option A: Extract shared data, use upsert return value
- **Effort:** Small | **Risk:** Low | ~30 LOC saved

## Acceptance Criteria

- [ ] Upsert data defined once, used for both create and update
- [ ] Upsert return value used directly instead of re-querying
- [ ] Activity sync still works correctly
