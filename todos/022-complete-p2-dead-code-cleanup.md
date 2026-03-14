---
status: pending
priority: p2
issue_id: "022"
tags: [code-review, quality, simplification]
dependencies: []
---

# Dead code across API: unused functions and exports

## Problem Statement

Multiple exported functions are never imported anywhere: `getAthleteProfile` (strava.ts), `checkSubscriptionHealth` (reconciliation.ts), `getRateLimitState` (rate-limiter.ts), and 4 functions in `date-utils.ts` (getDayOfWeek, getDayDates, prevWeek, nextWeek).

## Findings

- `strava.ts:93-103` — `getAthleteProfile` never called (11 LOC)
- `reconciliation.ts:58-66` — `checkSubscriptionHealth` placeholder (9 LOC)
- `rate-limiter.ts:73-75` — `getRateLimitState` never called (3 LOC)
- `date-utils.ts` — 4 unused utility functions (17 LOC)
- `strava.ts:4` — duplicate `STRAVA_API_BASE` (also in `strava-api.ts:4`)

## Proposed Solutions

### Option A: Delete all dead functions
- **Effort:** Small | **Risk:** Low | ~40 LOC saved

## Acceptance Criteria

- [ ] All dead functions removed
- [ ] No remaining unused exports
- [ ] TypeScript compiles cleanly
