---
status: pending
priority: p2
issue_id: "009"
tags: [code-review, architecture]
dependencies: []
---

# No global error handling middleware

## Problem Statement

Unhandled errors in route handlers will crash the Express process or leak stack traces to clients. There's no centralized error handler.

**Why it matters:** In production, an unhandled async rejection in any route handler will either crash the process (if `unhandledRejection` is set to throw) or silently hang the request.

## Findings

- No `app.use((err, req, res, next) => ...)` error middleware in `packages/api/src/index.ts`
- Route handlers use try/catch inconsistently — some have it, most don't
- Architecture strategist + Security sentinel both flagged

## Proposed Solutions

### Option A: Add global error middleware + async wrapper
- **Pros:** Catches all unhandled errors, consistent error responses, structured logging
- **Cons:** None
- **Effort:** Small
- **Risk:** Low

## Technical Details

- **Affected files:** `packages/api/src/index.ts`

## Acceptance Criteria

- [ ] Global error middleware catches unhandled route errors
- [ ] Error responses have consistent JSON format `{ error: string }`
- [ ] Stack traces not leaked in production
- [ ] Errors are logged with context (route, method, user ID)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Finding created from code review | Architecture strategist flagged |
