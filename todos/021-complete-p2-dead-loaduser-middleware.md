---
status: pending
priority: p2
issue_id: "021"
tags: [code-review, quality, simplification]
dependencies: []
---

# Dead `loadUser` middleware in auth.ts

## Problem Statement

The `loadUser` middleware (lines 38-63) is exported but never imported or used anywhere. All routes use `authenticate` (which sets `req.userId`) and query the user inline. Dead code in a security-sensitive file is confusing.

## Findings

- **Location:** `packages/api/src/middleware/auth.ts:38-63`
- Includes augmentation of Express Request type with `user` property that is never populated
- 26 LOC of dead code

## Proposed Solutions

### Option A: Delete the function and unused type augmentation
- **Effort:** Small | **Risk:** Low

## Acceptance Criteria

- [ ] `loadUser` function removed
- [ ] Unused `user` property removed from Request type augmentation
- [ ] Existing `authenticate` middleware unaffected
