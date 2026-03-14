---
status: pending
priority: p1
issue_id: "004"
tags: [code-review, security]
dependencies: []
---

# Access token stored in plaintext in database

## Problem Statement

The Strava access token is stored as plaintext in the `User.accessToken` column, while the refresh token is properly encrypted via `encrypt()`. A database breach exposes all users' active Strava access tokens.

**Why it matters:** Access tokens grant read/write access to a user's Strava data. If the DB is compromised, the attacker gets immediate API access for every connected user until tokens expire.

## Findings

- **Location:** `packages/api/src/routes/auth.ts:84,91` — `accessToken: tokens.access_token` stored raw
- **Contrast:** `refreshToken: encryptedRefreshToken` is properly encrypted on line 85/92
- Access tokens are short-lived (~6 hours) which limits blast radius, but the fix is trivial

## Proposed Solutions

### Option A: Encrypt access token the same way as refresh token
- **Pros:** Consistent, simple, reuses existing `encrypt()`/`decrypt()` functions
- **Cons:** Small overhead on every Strava API call (decrypt before use)
- **Effort:** Small
- **Risk:** Low

## Recommended Action

Option A — encrypt the access token using the existing `encrypt()` utility.

## Technical Details

- **Affected files:** `packages/api/src/routes/auth.ts`, `packages/api/src/lib/token-manager.ts`

## Acceptance Criteria

- [ ] Access token is encrypted before storage
- [ ] Access token is decrypted when used for Strava API calls
- [ ] Existing refresh token encryption is unchanged
- [ ] Strava API calls still function correctly

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Finding created from code review | Inconsistency between access/refresh token handling |

## Resources

- File: `packages/api/src/routes/auth.ts:84-92`
