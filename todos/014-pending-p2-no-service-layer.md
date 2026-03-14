---
status: pending
priority: p2
issue_id: "014"
tags: [code-review, architecture]
dependencies: []
---

# Business logic embedded in route handlers (no service layer)

## Problem Statement

Route handlers directly contain business logic (invite code generation, match scoring, group membership checks). This makes logic untestable in isolation and creates duplication risk as the API grows.

**Why it matters:** When the same logic is needed from multiple routes or background workers, it gets duplicated. Route handlers become 100+ line functions mixing HTTP concerns with domain logic.

## Findings

- Invite code generation and redemption logic in `groups.ts`
- Activity matching in workers
- Group authorization checks duplicated between routes
- Architecture strategist flagged as architectural concern

## Proposed Solutions

### Option A: Extract service layer incrementally
- **Pros:** Testable, reusable, cleaner routes
- **Cons:** Refactoring effort
- **Effort:** Large
- **Risk:** Low (can be done incrementally)

## Technical Details

- **Affected files:** All route files, new `packages/api/src/services/` directory

## Acceptance Criteria

- [ ] Business logic extracted to service functions
- [ ] Route handlers only handle HTTP concerns (parse request, call service, format response)
- [ ] Services are independently testable

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Finding created from code review | Architecture strategist flagged |
