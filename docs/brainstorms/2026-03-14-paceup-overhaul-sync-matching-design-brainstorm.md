---
topic: PaceUp Overhaul — Sync, Matching, Design & Mobile
date: 2026-03-14
participants: Lucas, Claude
status: complete
---

# PaceUp Overhaul — Sync, Matching, Design & Mobile

## What We're Building

A comprehensive overhaul of PaceUp across four areas:

1. **Sync overhaul** — Replace paginated backfill with a smart, stale-based single-call sync (200 activities), with real-time progress in the header
2. **Multi-workout/day + matching fixes** — Remove the one-workout-per-day database constraint, fix matching to support multiple activities per day, show completed activities on the planner
3. **Neobrutalism design system** — Bold, colorful neobrutalism style (thick borders, bright accents, chunky shadows) with a design doc that applies everywhere
4. **Mobile responsiveness** — Make the web app fully responsive, with architecture decisions that support an eventual native app

Additionally: a full data reset (delete all activities, matches, and planned workouts) to start fresh after sync fixes.

## Why This Approach

### Sync Overhaul

**Problem**: The current paginated backfill (30 activities per page, queued sequentially) is slow, hard to debug, and doesn't give users confidence that their data is syncing. The user can't tell if sync is working or broken.

**New approach**: When a user's last sync is >1 hour stale, fetch up to 200 activities from Strava's list endpoint in a single call, then enqueue each for detail fetching. Progress is shown in the header (SSE-powered, already built) for all users.

**Strava rate limits to respect**:
- 600 requests per 15 minutes overall
- 6,000 requests per day overall
- 300 read requests per 15 minutes
- 3,000 read requests per day

The list call counts as 1 read request. Each detail fetch is another read. So 200 activities = 201 reads — well within the 300/15min limit for a single user. For multi-user scenarios, the existing BullMQ rate limiter handles throttling.

### Multi-Workout/Day + Matching

**Problem**: The database has a unique constraint `[userId, weekStartDate, dayOfWeek]` on `PlannedWorkout`, physically preventing more than one workout per day. The `ActivityMatch` model also enforces 1:1 (both `activityId` and `plannedWorkoutId` are unique). This means runners who do two-a-day training (morning run + evening strength, double run days) can't plan or track properly.

**Fix**: Remove the unique constraint, allow unlimited workouts per day. Change matching to use best-score-wins (existing algorithm) across all same-day pairings. Each workout finds its best-fit activity greedily.

### Planner Display

**Problem**: The planner only shows activities that are matched to planned workouts. If matching fails or there's no planned workout, activities are invisible on the planner.

**Fix**: Show both planned workouts (with match status) AND unmatched activities on each day, visually separated. Planned workouts on top, unmatched activities below with a divider.

### Neobrutalism Design

**Problem**: The app looks outdated and generic — default Tailwind styling with no personality.

**Fix**: Create a neobrutalism design system document defining: color palette, border styles, shadows, typography, component patterns. Apply consistently across all pages. Bold + colorful vibe — thick black borders, bright accent colors (yellow, pink, blue), chunky offset shadows, playful but functional (Gumroad/Figma-inspired).

### Mobile

**Problem**: The app is desktop-only with no responsive design.

**Fix**: Make the web app responsive (mobile-first CSS), but architect component structure to support an eventual React Native port (shared hooks/state, platform-agnostic business logic).

## Key Decisions

1. **Stale threshold = 1 hour** — If last sync was >1 hour ago, trigger a fresh 200-activity list fetch on dashboard load. Otherwise rely on webhooks.
2. **Unlimited workouts per day** — Remove `[userId, weekStartDate, dayOfWeek]` unique constraint on PlannedWorkout. Add a `sortOrder` or `timeSlot` field instead.
3. **Best-score matching** — Keep the existing geometric mean scoring algorithm but allow multiple matches per day. Greedy assignment: highest-scoring pairs first, no double-booking.
4. **Planner shows everything** — Planned workouts with match indicators on top, unmatched activities shown below with visual separation.
5. **Bold neobrutalism** — Thick black borders (2-4px), bright accent colors, offset box shadows (4px 4px 0 black), chunky buttons, playful typography. Design doc created before implementation.
6. **Responsive web first, native later** — Mobile-first responsive CSS now. Keep hooks/state/API layer platform-agnostic for future React Native.
7. **Full data reset** — Delete all activities, matches, AND planned workouts for the user's account before re-syncing. Clean slate.
8. **Sync progress in header** — Already have SSE infrastructure. Show a progress bar/indicator in the navbar during sync (e.g., "Syncing 45/200 activities...").

## Scope & Ordering

Recommended implementation order:

1. **Data reset** (quick script) — Clear the slate
2. **Schema changes** — Remove unique constraint, update matching model
3. **Sync overhaul** — New stale-based sync, single list fetch, queue detail fetches
4. **Matching fixes** — Multi-activity-per-day matching with greedy best-score
5. **Planner updates** — Show both planned + unmatched activities
6. **Neobrutalism design doc** — Define the design system before applying it
7. **Apply design** — Restyle all pages using the design system
8. **Mobile responsiveness** — Responsive layouts across all pages

## Open Questions

_None — all questions resolved during brainstorming._
