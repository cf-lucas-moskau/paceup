---
status: pending
priority: p2
issue_id: "027"
tags: [code-review, quality]
dependencies: []
---

# Rate Limiter JSDoc Comment Shows Wrong Header Values

## Problem Statement

The JSDoc comment in `rate-limiter.ts:48-49` says `X-RateLimit-Limit: "200,2000"` but the actual defaults in code are 300/3000, and the file-level comment correctly says 300/3000.

## Findings

**Location:** `packages/api/src/lib/rate-limiter.ts:48-49`

```typescript
/**
 * Update rate limit state from Strava response headers.
 * Headers: X-RateLimit-Limit: "200,2000" X-RateLimit-Usage: "42,150"
 *          ^^^ Should be "300,3000"
 */
```

## Proposed Solutions

Fix the comment to say `"300,3000"`.

- **Effort:** Trivial
- **Risk:** None

## Acceptance Criteria

- [ ] Comment matches actual values
