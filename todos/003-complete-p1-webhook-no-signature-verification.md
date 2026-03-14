---
status: pending
priority: p1
issue_id: "003"
tags: [code-review, security]
dependencies: []
---

# Webhook endpoint lacks HMAC signature verification

## Problem Statement

`POST /api/webhooks/strava` accepts any incoming POST request as a valid Strava webhook event without verifying the request signature. Strava does not sign webhook payloads, but the endpoint should still verify the `subscription_id` matches the app's known subscription.

Additionally, anyone who discovers this endpoint can forge webhook events to trigger arbitrary activity fetches or delete user activities.

**Why it matters:** An attacker could trigger mass activity deletion by sending forged `delete` events, or flood the job queue with fake fetch requests.

## Findings

- **Location:** `packages/api/src/routes/webhooks.ts:41-53`
- **Code:** `const event = req.body as StravaWebhookEvent;` — no validation whatsoever
- The GET validation endpoint correctly checks `STRAVA_VERIFY_TOKEN`, but POST has no equivalent guard
- Strava documents that apps should verify `subscription_id` matches

## Proposed Solutions

### Option A: Verify subscription_id matches known value
- **Pros:** Simple, Strava-recommended approach
- **Cons:** Not cryptographic — still spoofable by anyone who knows the subscription ID
- **Effort:** Small
- **Risk:** Low

### Option B: Add IP allowlisting + subscription_id check
- **Pros:** Defense in depth
- **Cons:** Strava doesn't publish a stable IP list
- **Effort:** Medium
- **Risk:** Medium (could break if Strava changes IPs)

### Option C: Validate event payload with Zod schema + subscription_id
- **Pros:** Prevents malformed payloads AND unauthorized senders
- **Cons:** Slightly more code
- **Effort:** Small
- **Risk:** Low

## Recommended Action

Option C — validate subscription_id AND parse with Zod schema.

## Technical Details

- **Affected files:** `packages/api/src/routes/webhooks.ts`
- **Environment variable needed:** `STRAVA_SUBSCRIPTION_ID`

## Acceptance Criteria

- [ ] POST requests with wrong subscription_id are rejected (200 response but no processing)
- [ ] Malformed payloads are rejected
- [ ] Valid Strava events are processed normally
- [ ] Event payload is validated with Zod before processing

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Finding created from code review | Security sentinel flagged |

## Resources

- File: `packages/api/src/routes/webhooks.ts:41-53`
