# PaceUp — Brainstorm

**Date:** 2026-03-13
**Status:** Brainstorm complete

## What We're Building

PaceUp is a modern training-focused running app for running communities. It uses Strava for authentication and activity data, but provides what Strava lacks: **weekly training planning, structured analysis, and group accountability**.

Think of it as a hybrid between Strava's activity tracking and TrainingPeaks' planning — with a clean, modern UI that strips away the noise.

### Target Audience

Running communities: clubs, coaching groups, and friend circles (5-50+ people). Not a personal-only tool, not a mass-market product at launch.

### Core Features

1. **Strava OAuth Login** — Sign in with Strava. No separate accounts.

2. **Weekly Training Planner**
   - Runners create their own weekly plans
   - Coaches can also create and assign plans to athletes in their group
   - V1: Simple workout targets (type + distance/duration, e.g. "Easy Run — 10km", "Intervals — 8x400m")
   - Future: Structured multi-step workouts (warm-up, intervals, cool-down, target paces/zones)

3. **Activity Analysis**
   - Per-run detail page with pace, splits, elevation, distance
   - Heart rate zone distribution, avg/max HR, training effect
   - Map view of the route
   - Plan vs. actual comparison (did the run match the planned workout?)

4. **Activity Feed**
   - Lightweight timeline of friends' completed activities
   - Cleaner and less noisy than Strava's social feed
   - No kudos/comments clutter — focused on the training data

5. **Group Training View**
   - Weekly calendar showing the group's plan vs. actual side-by-side
   - Accountability dashboard: who's on track, who missed workouts
   - Coach perspective: see all athletes' adherence at a glance

6. **Synced Backend**
   - Strava webhooks for real-time activity updates
   - Periodic background backfill job for initial import and catching missed events
   - Local database holds full activity state to avoid hitting Strava API limits

## Why This Approach

### Architecture: SPA + API Monorepo

- **React + TypeScript SPA** (Vite) for the frontend — modern, fast, component-driven
- **Node.js + Express API** for the backend — familiar JS ecosystem, good Strava SDK support
- **PostgreSQL + Prisma ORM** for persistent storage — users, activities, training plans, groups
- **Single monorepo** with `packages/web` and `packages/api` (or similar structure)
- **Deployment:** Frontend to Vercel/Netlify, API to Railway/Fly.io

### Why not Next.js?

Preference for clean separation between SPA and API. Next.js blurs the backend boundary and the app has a clear need for a standalone API (webhook endpoints, background jobs, cron-based sync).

### Why not a separate sync service?

YAGNI. Background jobs within Express are sufficient at launch scale. Can extract to a dedicated worker if sync load becomes a bottleneck.

### Strava API Strategy

- **Webhooks** are the primary data ingestion mechanism (Strava pushes activity create/update/delete events)
- **Backfill job** runs on user signup (import historical activities) and periodically to catch gaps
- **Token refresh** handled server-side; store encrypted refresh tokens
- **Rate limit awareness:** 100 requests per 15 minutes, 1000 per day per app. Webhook-first approach minimizes polling. Backfill jobs should be queued and rate-limited.

## Key Decisions

1. **Strava as the sole auth provider** — No email/password. Simplifies onboarding and guarantees every user has connected Strava data.

2. **Planning starts simple** — V1 is type + distance/duration per day. Structured workouts (multi-step with pace targets) come later.

3. **Dual planning model** — Both self-planning and coach-assigned plans. Coach can override but runner always sees their plan.

4. **Group accountability over social** — The group training view is the differentiator, not a better feed. Feed exists for awareness, not engagement.

5. **Backend owns activity state** — All Strava data is mirrored locally. Frontend never calls Strava directly. This protects against rate limits and enables richer queries.

6. **React + Express monorepo** — Clean separation, familiar stack, independently deployable.

7. **PWA from day one** — Installable web app with offline support. No native mobile app at launch.

8. **Groups with roles** — Any user can create a group and invite others. Groups have coach/athlete roles. Coach role enables plan assignment. Runners can join multiple groups.

9. **Prisma ORM** — Type-safe database access with auto-generated client and easy migrations.

10. **In-app notifications only** — Simple notification center inside the app for V1. No email or push at launch.

## Resolved Questions

1. **ORM choice** — Prisma. Type-safe, great DX, strong TS ecosystem fit.
2. **Mobile strategy** — PWA from day one. Installable, offline-capable, no native app needed yet.
3. **Group/team structure** — Open group creation with coach/athlete roles. Runners can belong to multiple groups.
4. **Notifications** — In-app notification center only for V1. Push/email deferred.
