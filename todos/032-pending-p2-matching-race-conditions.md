---
status: pending
priority: p2
issue_id: "032"
tags: [code-review, performance, race-condition]
dependencies: []
---

# Fire-and-Forget Matching Creates Race Conditions on Concurrent Edits

## Problem Statement

All three workout mutation endpoints (POST, PUT, DELETE) call `runMatchingForUser().catch()` as fire-and-forget. If a coach rapidly creates 7 workouts for an athlete, 7 concurrent matching runs execute simultaneously, each doing:
1. Query all unmatched workouts
2. Query all unmatched activities
3. Score and create matches

This can create duplicate `ActivityMatch` records or fail with unique constraint violations.

## Findings

**Location:** `packages/api/src/routes/workouts.ts:133-135, 175-177, 201-203`

The `ActivityMatch` table has `@unique` on both `activityId` and `plannedWorkoutId`, so concurrent inserts for the same pair will fail with a Prisma error. The `.catch()` swallows this as "Matching after workout create failed" — the match silently doesn't happen.

## Proposed Solutions

### Solution 1: Debounce matching per user+week (Recommended)
Use a simple Map<string, NodeJS.Timeout> to debounce matching calls:
```typescript
const pendingMatches = new Map<string, ReturnType<typeof setTimeout>>();
function debouncedMatch(userId: string, weekStart: Date) {
  const key = `${userId}:${weekStart.toISOString()}`;
  const existing = pendingMatches.get(key);
  if (existing) clearTimeout(existing);
  pendingMatches.set(key, setTimeout(() => {
    pendingMatches.delete(key);
    runMatchingForUser(userId, weekStart).catch(...);
  }, 500));
}
```
- **Effort:** Small
- **Risk:** Low

### Solution 2: Queue matching through BullMQ with deduplication
- **Effort:** Medium
- **Risk:** Low

## Acceptance Criteria

- [ ] Rapid concurrent workout edits don't produce duplicate matches
- [ ] Matching still runs within a reasonable delay after edits
