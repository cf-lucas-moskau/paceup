---
status: pending
priority: p2
issue_id: "011"
tags: [code-review, security]
dependencies: []
---

# Open redirect via reauth parameter in scope-required page

## Problem Statement

The OAuth callback redirects to `${FRONTEND_URL}/auth/scope-required?reauth=<url>`, where the `reauth` value is a Strava URL. If a frontend page blindly redirects the user to the `reauth` query parameter, this could be used for phishing by replacing it with an attacker-controlled URL.

**Why it matters:** Open redirects are commonly used in phishing attacks to make malicious links appear legitimate.

## Findings

- **Location:** `packages/api/src/routes/auth.ts:59-62`
- The `reauth` URL is constructed from `getReAuthorizationUrl()` which returns a Strava URL
- Need to verify the frontend page validates the URL before redirecting

## Proposed Solutions

### Option A: Validate redirect URL server-side, only allow Strava domain
- **Pros:** Defense in depth
- **Cons:** None
- **Effort:** Small
- **Risk:** Low

## Technical Details

- **Affected files:** `packages/api/src/routes/auth.ts`, frontend scope-required page

## Acceptance Criteria

- [ ] reauth URL is validated to only point to strava.com
- [ ] Arbitrary URLs in reauth param are rejected

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Finding created from code review | Security sentinel flagged |
