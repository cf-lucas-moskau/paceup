---
status: pending
priority: p3
issue_id: "029"
tags: [code-review, quality, logic-error]
dependencies: []
---

# Workout Update Match-Clearing Condition Uses Truthy Check on workoutType

## Problem Statement

In the PUT `/api/workouts/:id` handler, the condition for clearing existing auto-matches checks `parsed.data.workoutType` with a truthy check. If someone sent `workoutType: ""` (empty string), it would be falsy and skip match clearing even though the workout type was changed.

## Findings

**Location:** `packages/api/src/routes/workouts.ts:163`

```typescript
if (parsed.data.workoutType || parsed.data.targetDistance !== undefined || parsed.data.targetDuration !== undefined) {
    await prisma.activityMatch.deleteMany({ ... });
}
```

Should be `parsed.data.workoutType !== undefined` for consistency with the other fields.

## Proposed Solutions

Change to `parsed.data.workoutType !== undefined`.

- **Effort:** Trivial
- **Risk:** None

## Acceptance Criteria

- [ ] Match clearing triggers when any of the three fields are present in the update, regardless of value
