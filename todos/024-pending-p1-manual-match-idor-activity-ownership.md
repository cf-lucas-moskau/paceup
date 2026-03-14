---
status: complete
priority: p1
issue_id: "024"
tags: [code-review, security, idor]
dependencies: []
---

# Manual Match Endpoint Missing Activity Ownership Check

## Problem Statement

The `POST /api/workouts/:id/match` endpoint (manual match override) verifies that the workout belongs to the authenticated user, but does NOT verify that the `activityId` belongs to them. A user could match their workout to any activity in the system, including other users' activities.

Additionally, `activityId` is not validated with zod — it's destructured from `req.body` with only a truthy check.

## Findings

**Location:** `packages/api/src/routes/workouts.ts:209-242`

```typescript
// Line 210: activityId comes from unvalidated req.body
const { activityId } = req.body;

// Line 217-224: Workout ownership IS checked
const workout = await prisma.plannedWorkout.findUnique({ where: { id: req.params.id } });
if (!workout || workout.userId !== req.userId) { ... }

// Line 226-230: Deletes existing matches for BOTH the workout AND the activity
// This means a user could UNMATCH another user's activity from their workout
await prisma.activityMatch.deleteMany({
  where: { OR: [{ plannedWorkoutId: req.params.id }, { activityId }] },
});

// Line 232-238: Creates match linking workout to unverified activity
const match = await prisma.activityMatch.create({ data: { activityId, ... } });
```

**Impact:**
1. User A can match their workout to User B's activity
2. The `deleteMany` with `OR` condition means User A can also UNMATCH User B's existing match
3. No input validation on `activityId` type (could be non-string)

## Proposed Solutions

### Solution 1: Add activity ownership verification (Recommended)
```typescript
const activity = await prisma.activity.findUnique({
  where: { id: activityId },
  select: { userId: true },
});
if (!activity || activity.userId !== req.userId) {
  res.status(404).json({ error: 'Activity not found' });
  return;
}
```
- **Pros:** Simple, direct fix
- **Cons:** One additional DB query
- **Effort:** Small
- **Risk:** Low

### Solution 2: Add zod validation + ownership check
Add `activityId` to a zod schema and verify ownership.
- **Pros:** Type-safe + secure
- **Cons:** Slightly more code
- **Effort:** Small
- **Risk:** Low

## Recommended Action

Solution 2 — validate input type with zod AND verify ownership.

## Technical Details

- **Affected files:** `packages/api/src/routes/workouts.ts`
- **Components:** Workout match API
- **Database changes:** None

## Acceptance Criteria

- [x] `activityId` is validated as a string via zod
- [x] Activity ownership is verified before creating the match
- [x] Returns 404 if activity doesn't exist or doesn't belong to user
- [x] The `deleteMany` OR condition only affects the user's own matches

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Identified during code review | IDOR pattern: always verify ownership of ALL referenced entities, not just the primary resource |
| 2026-03-14 | Fixed: added zod schema + activity ownership check | Solution 2 applied — zod validates activityId as string, prisma query verifies userId match |
