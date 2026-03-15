---
status: pending
priority: p2
issue_id: "025"
tags: [code-review, performance]
dependencies: []
---

# Sync Trigger Scans All Queued Jobs to Check for Duplicates

## Problem Statement

The `POST /api/sync/trigger` endpoint checks if a sync is already in progress by calling `syncListQueue.getJobs(['active', 'waiting', 'delayed'])` and then iterating through ALL jobs to find one matching the current user. This is O(n) on total queue size across all users.

## Findings

**Location:** `packages/api/src/routes/sync-status.ts:66-67`

```typescript
const existingJobs = await syncListQueue.getJobs(['active', 'waiting', 'delayed']);
const alreadySyncing = existingJobs.some((job) => job.data.userId === userId);
```

At scale with many concurrent users, this loads all job objects from Redis into memory just to check if ONE user has an active job.

## Proposed Solutions

### Solution 1: Use deterministic jobId pattern (Recommended)
Since `syncListQueue.add` already uses `jobId: sync-${userId}-${Date.now()}`, use `getJob()` with a known ID pattern, or use a Redis key/flag:
```typescript
// Set a flag when enqueueing, clear when done
const isSyncing = await redis.get(`sync:active:${userId}`);
if (isSyncing) { res.json({ status: 'syncing' }); return; }
```
- **Pros:** O(1) lookup, no memory overhead
- **Cons:** Need to manage the flag lifecycle
- **Effort:** Small
- **Risk:** Low

### Solution 2: Use BullMQ getJob with predictable ID
Use a fixed jobId per user (without timestamp) so you can look it up directly.
- **Pros:** Uses BullMQ native API
- **Cons:** Need unique job IDs, can't have multiple pages queued
- **Effort:** Medium
- **Risk:** Medium (changes job ID semantics)

## Recommended Action

Solution 1 — Redis flag is simplest and most performant.

## Technical Details

- **Affected files:** `packages/api/src/routes/sync-status.ts`, `packages/api/src/queues/sync-worker.ts`

## Acceptance Criteria

- [ ] Duplicate sync check is O(1) instead of O(n)
- [ ] No false positives (flag cleared after sync completes or fails)
- [ ] Flag has TTL to prevent stuck states

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Identified during code review | BullMQ `getJobs()` loads all job data — avoid for single-user lookups |
