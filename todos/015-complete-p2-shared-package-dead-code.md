---
status: pending
priority: p2
issue_id: "015"
tags: [code-review, quality]
dependencies: []
---

# packages/shared is dead code — never imported by web or api

## Problem Statement

The `packages/shared` workspace exists with types and utilities but is never imported by either `packages/web` or `packages/api`. It's dead code that adds confusion about where shared types should live.

**Why it matters:** New contributors may add types to `shared` expecting them to be used, or duplicate types that already exist there. The package adds build complexity without value.

## Findings

- `packages/shared/` exists with exported types
- Neither `packages/web/package.json` nor `packages/api/package.json` depend on it
- No import statements reference `@paceup/shared` in either package
- TypeScript reviewer + Architecture strategist both flagged

## Proposed Solutions

### Option A: Delete packages/shared, define types where used
- **Pros:** Removes dead code, simplifies monorepo
- **Cons:** Types will need sharing later as API contract solidifies
- **Effort:** Small
- **Risk:** Low

### Option B: Wire up shared package and consolidate duplicated types
- **Pros:** Single source of truth for API types
- **Cons:** More build complexity (needs proper tsconfig references)
- **Effort:** Medium
- **Risk:** Low

## Technical Details

- **Affected files:** `packages/shared/`, root `package.json`

## Acceptance Criteria

- [ ] Either shared package is deleted or properly wired up
- [ ] No orphaned type definitions

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Finding created from code review | Multiple agents flagged |
