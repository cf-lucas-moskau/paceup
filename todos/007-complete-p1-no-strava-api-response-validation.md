---
status: pending
priority: p1
issue_id: "007"
tags: [code-review, security, quality]
dependencies: []
---

# No Strava API response validation — trusting external data blindly

## Problem Statement

Strava API responses are cast directly to TypeScript interfaces without runtime validation. If Strava changes their API response format, the app will silently store malformed data or crash unpredictably.

**Why it matters:** External API responses are an untrusted boundary. TypeScript types are compile-time only — they provide no runtime safety against unexpected shapes, missing fields, or type mismatches.

## Findings

- **Location:** `packages/api/src/routes/auth.ts:66` — `exchangeCodeForTokens(code)` result used without validation
- **Location:** `packages/api/src/routes/webhooks.ts:42` — `req.body as StravaWebhookEvent` cast
- Activity worker likely has similar patterns with activity detail responses
- The `createWorkoutSchema` in workouts.ts shows Zod is already in the project

## Proposed Solutions

### Option A: Add Zod schemas for Strava API responses
- **Pros:** Runtime validation, good error messages, already using Zod
- **Cons:** Need to define schemas matching Strava's API
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

Option A — create Zod schemas for Strava token response, athlete profile, activity detail, and webhook event.

## Technical Details

- **Affected files:** `packages/api/src/lib/strava.ts`, `packages/api/src/routes/webhooks.ts`, activity worker

## Acceptance Criteria

- [ ] Strava token exchange response is validated with Zod
- [ ] Webhook event payload is validated with Zod
- [ ] Activity detail response from Strava API is validated
- [ ] Invalid responses are logged and handled gracefully (not silently swallowed)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Finding created from code review | TypeScript reviewer + Security sentinel |

## Resources

- File: `packages/api/src/routes/auth.ts:66`
- File: `packages/api/src/routes/webhooks.ts:42`
