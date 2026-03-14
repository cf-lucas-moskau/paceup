---
status: pending
priority: p2
issue_id: "013"
tags: [code-review, quality]
dependencies: []
---

# BigInt serialization inconsistent across API routes

## Problem Statement

`stravaActivityId` is a BigInt in Prisma but JSON doesn't support BigInt. Some routes manually convert with `.toString()`, others don't, risking runtime `TypeError: Do not know how to serialize a BigInt`.

**Why it matters:** Inconsistent serialization means some endpoints work while others silently fail or throw, depending on whether the response includes the BigInt field.

## Findings

- **Location:** `packages/api/src/routes/feed.ts:70-73` — manual `.toString()` conversion
- Other routes (activities, group-training) may not handle it
- Architecture strategist flagged as systemic issue

## Proposed Solutions

### Option A: Global BigInt JSON serializer
- **Pros:** One-time fix, all routes covered
- **Cons:** Mutates global prototype (some linters warn)
- **Effort:** Small
- **Risk:** Low

### Option B: Prisma middleware for BigInt serialization
- **Pros:** Handles at ORM layer, clean
- **Cons:** Prisma middleware deprecated in favor of extensions
- **Effort:** Small
- **Risk:** Low

## Technical Details

- **Affected files:** `packages/api/src/index.ts` or `packages/api/src/lib/prisma.ts`

## Acceptance Criteria

- [ ] All API responses serialize BigInt fields as strings
- [ ] No manual `.toString()` needed in individual routes
- [ ] No `TypeError: BigInt` errors in any endpoint

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Finding created from code review | Architecture strategist flagged |
