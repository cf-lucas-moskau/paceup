---
status: pending
priority: p2
issue_id: "008"
tags: [code-review, security]
dependencies: []
---

# No API rate limiting on auth, webhooks, or mutation endpoints

## Problem Statement

No rate limiting on any API endpoints. Auth endpoints are particularly sensitive — brute force attempts, webhook flooding, and rapid mutations are all unthrottled.

**Why it matters:** Without rate limiting, an attacker can flood the webhook endpoint to fill the job queue, spam group invites, or overwhelm the Strava API token bucket.

## Findings

- No `express-rate-limit` or equivalent middleware
- Auth endpoints (`/api/auth/strava/callback`) could be hammered
- Webhook endpoint processes every request with no throttle
- Group creation and invite generation have no limits

## Proposed Solutions

### Option A: Add express-rate-limit middleware
- **Pros:** Simple, well-tested, configurable per route
- **Cons:** Needs Redis store for multi-instance deployments
- **Effort:** Small
- **Risk:** Low

## Technical Details

- **Affected files:** `packages/api/src/index.ts`, new middleware file

## Acceptance Criteria

- [ ] Auth endpoints: max 10 requests/minute per IP
- [ ] Webhook endpoint: max 100 requests/minute per IP
- [ ] Mutation endpoints: max 30 requests/minute per user
- [ ] Rate limit headers returned (X-RateLimit-*)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Finding created from code review | Security sentinel flagged |
