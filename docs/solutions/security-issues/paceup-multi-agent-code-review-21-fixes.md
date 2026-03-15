---
title: "PaceUp Code Review: 21 Security, Performance & Quality Fixes"
category: security-issues
date: 2026-03-14
tags: [idor, encryption, rate-limiting, webhook-validation, dead-code, code-splitting, express, prisma, strava-api]
---

# PaceUp Multi-Agent Code Review: 21 Fixes in One Pass

## Problem

A 7-agent code review (TypeScript, Security, Performance, Architecture, Code Simplicity, Agent-Native, Learnings) of the PaceUp monorepo (Express API + React frontend) uncovered 23 findings across 3 priority tiers. 7 were P1 critical security issues, 12 were P2 important fixes, and 4 were P3 nice-to-haves.

## Root Cause

The codebase was in early development with security hardening deferred. Key gaps: no authorization checks on multi-user endpoints, plaintext token storage, unvalidated external API responses, no rate limiting, and accumulated dead code from removed features.

## Solution

Fixed 21 of 23 findings (2 deferred: JWT revocation needs DB migration, service layer extraction is a large refactor). Commit: `9d6fbfc`.

### P1 Critical Security (7 fixes)

1. **IDOR on workouts read** (`workouts.ts`): Added coach-in-shared-group authorization check when `?userId=` param targets another user. Returns 403 if caller isn't a coach in a shared group.

2. **IDOR on match delete** (`workouts.ts`): Added ownership verification — workout must belong to `req.userId` before allowing match deletion.

3. **Webhook payload validation** (`webhooks.ts`): Added Zod schema validation for all Strava webhook events + `subscription_id` verification against `STRAVA_SUBSCRIPTION_ID` env var.

4. **Access token plaintext storage** (`auth.ts`, `token-manager.ts`): Access tokens now encrypted with AES-256-GCM before DB storage (refresh tokens were already encrypted). Token manager decrypts on read.

5. **Weak encryption key derivation** (`encryption.ts`): Key derivation now accepts hex-encoded 256-bit keys directly, or derives via SHA-256 hash. Validates minimum 32-character input.

6. **Notification route ordering** (`notifications.ts`): Moved `PUT /read-all` before `PUT /:id/read` — Express was matching "read-all" as an `:id` parameter.

7. **No Strava API response validation** (`strava.ts`): Added Zod schemas for token exchange and refresh responses. Merged duplicate auth URL functions into single `getAuthorizationUrl(state, forcePrompt)`.

### P2 Important (10 fixes)

8. **Rate limiting** (`index.ts`, `rate-limiter.ts`): Added `express-rate-limit` with 3 tiers: auth (10/min), webhook (100/min), API (60/min).

9. **Global error handling** (`index.ts`): Added Express error middleware that catches unhandled errors and returns 500 with structured response.

10. **Feed N+1 queries** (`feed.ts`): Reduced from 3 sequential DB queries to 2 using Prisma nested filter with `distinct`.

11. **Open redirect on reauth** (`ScopeRequired.tsx`): Frontend now validates reauth URL only allows `https://www.strava.com/oauth/` prefix.

13. **BigInt serialization** (`index.ts`): Added global `BigInt.prototype.toJSON` to prevent serialization crashes.

15. **Dead shared package** (`packages/shared/`): Deleted entirely — unused by both API and web. Removed from dependencies and build scripts.

21. **Dead loadUser middleware** (`middleware/auth.ts`): Removed unused middleware and `user` property from Request type.

22. **Dead code cleanup**: Removed unused exports from `rate-limiter.ts`, dead `checkSubscriptionHealth` placeholder, 4 unused date utility functions.

23. **Activity worker duplication** (`activity-worker.ts`): Extracted shared `activityData` object to eliminate copy-paste between update/create paths. Removed unnecessary re-query after upsert.

### P3 Nice-to-Have (4 fixes)

16. **Lazy loading** (`App.tsx`): ActivityDetail page lazy-loaded with `React.lazy` + `Suspense`.

17. **SPA navigation** (`Navbar.tsx`): Replaced `<a href>` tags with React Router `<Link>` components.

18. **Code splitting** (`vite.config.ts`): Added `manualChunks` for recharts, date-fns, and vendor bundle.

19. **Dashboard over-fetch** (`Dashboard.tsx`, `hooks.ts`): `useActivities` now accepts `limit` param; dashboard requests only 5 instead of default 20.

20. **Dead DnD code** (`Planner.tsx`, `WorkoutCard.tsx`, `package.json`): Removed all `@dnd-kit` imports, hooks, and dependencies — drag-and-drop was wired up but `handleDragEnd` was a no-op.

## Prevention

- Run multi-agent security reviews before any deployment to production
- Always add authorization checks when endpoints accept user ID parameters (IDOR is the most common vulnerability in multi-tenant apps)
- Encrypt all tokens at rest, not just refresh tokens
- Validate all external API responses with schemas (Zod) at the boundary
- Add rate limiting from day one — retrofitting is harder
- Regularly audit for dead code, especially after removing features

## Deferred Items

- **Todo 012**: JWT revocation mechanism (requires DB migration for token blacklist table)
- **Todo 014**: Service layer extraction (large refactor to move business logic out of route handlers)
