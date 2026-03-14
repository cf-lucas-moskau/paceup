---
status: pending
priority: p2
issue_id: "010"
tags: [code-review, performance]
dependencies: []
---

# Feed endpoint makes 3 sequential queries (N+1 pattern)

## Problem Statement

`GET /api/feed` performs 3 sequential Prisma queries: (1) user's group memberships, (2) all members of those groups, (3) activities from those members. This fan-out pattern scales poorly with group count.

**Why it matters:** For a user in 5 groups with 50 members each, this generates 3 round-trips before returning any data. As the app grows, this will become the slowest endpoint.

## Findings

- **Location:** `packages/api/src/routes/feed.ts:15-63`
- Query 1: Get user's group memberships (line 15)
- Query 2: Get all member IDs from those groups (line 31)
- Query 3: Fetch activities (line 47)
- Could be collapsed to 1-2 queries with Prisma relations or raw SQL

## Proposed Solutions

### Option A: Use Prisma nested relations to reduce to 1-2 queries
- **Pros:** Stays within Prisma, cleaner code
- **Cons:** May produce complex SQL
- **Effort:** Small
- **Risk:** Low

### Option B: Raw SQL with CTEs
- **Pros:** Most efficient, single round-trip
- **Cons:** Bypasses Prisma type safety
- **Effort:** Medium
- **Risk:** Medium

## Technical Details

- **Affected files:** `packages/api/src/routes/feed.ts`

## Acceptance Criteria

- [ ] Feed query reduced to 1-2 database round-trips
- [ ] Response time under 200ms for typical user (5 groups, 50 members)
- [ ] Cursor-based pagination still works

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Finding created from code review | Performance oracle flagged |
