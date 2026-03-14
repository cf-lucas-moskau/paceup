---
status: pending
priority: p1
issue_id: "001"
tags: [code-review, security]
dependencies: []
---

# IDOR: Any authenticated user can read any other user's workouts

## Problem Statement

`GET /api/workouts?userId=<targetId>` accepts an arbitrary `userId` query parameter with no authorization check. Any authenticated user can read another user's planned workouts by passing their user ID.

**Why it matters:** Exposes private training plans. An athlete's weekly schedule, distances, and workout types are visible to anyone with a valid JWT.

## Findings

- **Location:** `packages/api/src/routes/workouts.ts:23`
- **Code:** `const targetUserId = (req.query.userId as string) || req.userId!;`
- **No check** verifies the caller is authorized to view the target user's workouts (e.g., is their coach, is in the same group).

## Proposed Solutions

### Option A: Remove userId param, only allow own workouts
- **Pros:** Simplest fix, zero attack surface
- **Cons:** Breaks coach view (coaches need to see athletes' plans)
- **Effort:** Small
- **Risk:** Low

### Option B: Add group membership + role authorization check
- **Pros:** Coaches can view athletes in their groups, athletes see only their own
- **Cons:** More complex, requires DB lookup
- **Effort:** Medium
- **Risk:** Low

### Option C: Separate coach endpoint
- **Pros:** Clear separation of concerns
- **Cons:** Code duplication
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

Option B — verify the caller is either the target user or a coach in a shared group.

## Technical Details

- **Affected files:** `packages/api/src/routes/workouts.ts`
- **Components:** Workouts API route handler

## Acceptance Criteria

- [ ] Unauthenticated requests return 401
- [ ] Requesting own workouts works as before
- [ ] Requesting another user's workouts without shared group membership returns 403
- [ ] Coaches in a shared group can view athlete workouts
- [ ] Athletes cannot view other athletes' workouts (unless via group-training endpoint)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Finding created from code review | Security sentinel + TypeScript reviewer both flagged |

## Resources

- PR: current branch
- File: `packages/api/src/routes/workouts.ts:23`
