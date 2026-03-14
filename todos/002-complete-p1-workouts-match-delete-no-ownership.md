---
status: pending
priority: p1
issue_id: "002"
tags: [code-review, security]
dependencies: []
---

# IDOR: DELETE /api/workouts/:id/match has no ownership check

## Problem Statement

`DELETE /api/workouts/:id/match` deletes the activity match for a workout without verifying the caller owns that workout. Any authenticated user can unmatch any other user's workout-activity pairing.

**Why it matters:** An attacker could systematically unmatch all activity-workout pairs, breaking compliance tracking for an entire group.

## Findings

- **Location:** `packages/api/src/routes/workouts.ts:183-188`
- **Code:** Directly calls `prisma.activityMatch.deleteMany({ where: { plannedWorkoutId: req.params.id } })` without any ownership verification
- **Contrast:** `PUT /:id` and `DELETE /:id` both check `existing.userId !== req.userId`

## Proposed Solutions

### Option A: Add ownership check (consistent with PUT/DELETE)
- **Pros:** Simple, follows existing pattern in the same file
- **Cons:** None
- **Effort:** Small
- **Risk:** Low

## Recommended Action

Option A — look up the planned workout and verify `userId === req.userId` before deleting match.

## Technical Details

- **Affected files:** `packages/api/src/routes/workouts.ts`

## Acceptance Criteria

- [ ] Deleting own workout match returns 200
- [ ] Deleting another user's workout match returns 403 or 404
- [ ] Workout ownership is verified before any mutation

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Finding created from code review | Pattern inconsistency within the same file |

## Resources

- File: `packages/api/src/routes/workouts.ts:183-188`
