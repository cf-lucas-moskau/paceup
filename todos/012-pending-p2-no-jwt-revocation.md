---
status: pending
priority: p2
issue_id: "012"
tags: [code-review, security]
dependencies: []
---

# No JWT revocation mechanism

## Problem Statement

JWTs are valid for 7 days with no way to revoke them. If a user deauthorizes Strava or their account is compromised, their JWT remains valid until natural expiry.

**Why it matters:** Strava deauthorization webhook correctly clears tokens, but the user's PaceUp session (JWT cookie) remains valid. They can continue accessing the app with stale credentials.

## Findings

- **Location:** `packages/api/src/routes/auth.ts:119-125` — 7-day cookie
- Webhook deauth handler clears tokens but can't invalidate JWTs
- No token blacklist or version check

## Proposed Solutions

### Option A: Add token version field to User, check on auth
- **Pros:** Simple, no external dependency, increment version to invalidate all sessions
- **Cons:** Extra DB query on every request (but `auth/me` already does this)
- **Effort:** Small
- **Risk:** Low

### Option B: Short-lived JWTs (15min) + refresh token rotation
- **Pros:** Industry standard, limits window of compromise
- **Cons:** More complex, needs refresh endpoint
- **Effort:** Medium
- **Risk:** Medium

## Technical Details

- **Affected files:** `packages/api/src/middleware/auth.ts`, `packages/api/src/lib/jwt.ts`

## Acceptance Criteria

- [ ] Strava deauth invalidates all active sessions
- [ ] Compromised JWT can be revoked without affecting other users

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Finding created from code review | Security sentinel flagged |
