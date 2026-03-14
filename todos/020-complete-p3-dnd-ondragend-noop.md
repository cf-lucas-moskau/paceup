---
status: pending
priority: p3
issue_id: "020"
tags: [code-review, quality]
dependencies: []
---

# DnD onDragEnd handler is a no-op

## Problem Statement

The drag-and-drop handler in the planner page has an `onDragEnd` callback that doesn't persist the reorder. Workouts can be visually dragged but the change is not saved.

## Findings

- TypeScript reviewer flagged the handler as incomplete
- The planner supports creating/editing workouts but drag reorder doesn't persist

## Proposed Solutions

### Option A: Implement the reorder logic (update dayOfWeek on drop)
- **Effort:** Small | **Risk:** Low

### Option B: Remove DnD if reordering isn't needed
- **Effort:** Small | **Risk:** Low

## Acceptance Criteria

- [ ] Either DnD works end-to-end or is removed
