---
title: "PaceUp: Live Sync Status, Activity Data Tiers, Filters & Logo"
date: 2026-03-14
type: brainstorm
---

# PaceUp: Live Sync Status, Activity Data Tiers, Filters & Logo

## What We're Building

Five improvements to PaceUp, shipped together on a single feature branch:

### 1. Live Sync Status in Header (SSE)

A persistent header indicator showing Strava sync progress, visible to all users. Group members can see each other's sync status.

- **Delivery mechanism:** Server-Sent Events (SSE) from the API
- **Data source:** BullMQ job progress events from the activity queue, backfill queue, and reconciliation
- **Audience:** All group members can see each other's sync status
- **UX:** Header bar shows "Syncing 12/45 activities..." or "All synced" with a subtle animation. When a group member is syncing, their name appears in the indicator.

### 2. Activity Data Tier Indicator + Auto-Fetch

Activities currently look the same whether they have only list-level summary data or full detailed data with streams.

- **Approach:** Auto-fetch full details when a user opens an activity detail page
- **UX:** Show loading spinners/skeleton states for sections (streams, charts, detailed stats) that are still being fetched. No explicit "basic vs full" badge needed — the detail page handles it transparently.
- **Backend:** The activity worker already fetches full detail from `/api/v3/activities/{id}`. Streams are already lazy-loaded on view. The key improvement is surfacing loading states and ensuring the auto-fetch is obvious to the user.

### 3. Reduce Backfill to 30 Days

Currently backfills 6 months of history on first connect. Reduce to 30 days.

- **Reason:** Faster onboarding, fewer API calls, most users only care about recent training
- **Change:** Update `backfill-worker.ts` to use 30-day lookback instead of 6 months
- **Loading order:** Most recent activities first, working backwards

### 4. Activity List Filters

Add filtering to the activities page:

- **Text search** on activity name
- **Sport type** filter (Run, Ride, Swim, etc.)
- **Date range** picker
- **Implementation:** Client-side filtering for loaded activities, with server-side support for the API query params

### 5. Simple Text Logo

Create a text-based "PaceUp" logo using the brand orange (#f97316) and set it up as:

- Favicon (multiple sizes)
- PWA icons (192x192 and 512x512)
- Navbar brand mark

## Why This Approach

**Single branch:** These features touch related areas (header, activity list, activity detail) and share context. Building together avoids repeated review cycles and lets us optimize shared changes (e.g., activity model updates serve both the tier indicator and filters).

**SSE over WebSocket/Polling:** SSE is the right fit — it's one-way (server to client), lightweight, works through proxies, and requires no new infrastructure beyond the Express server. We already have Redis/BullMQ for the event source.

**Auto-fetch over badges:** Users don't need to think about data tiers. The detail page should just work — fetch what's missing, show loading states, done. This is the least cognitive overhead for users.

**30-day backfill:** Aligns with the training-focused nature of the app. Runners care about this week and last week, not 6 months ago. Faster onboarding is a win.

## Key Decisions

1. **SSE for real-time sync status** — not WebSocket (overkill) or polling (wasteful)
2. **Group-wide sync visibility** — all group members see each other's sync progress
3. **Auto-fetch on activity view** — no explicit "basic/full" distinction exposed to users
4. **30-day backfill window** — down from 6 months, most-recent-first ordering
5. **Search + sport type + date range** — the three filter dimensions for activities
6. **Simple text logo** — "PaceUp" in brand orange, used as favicon + PWA icons
7. **Single feature branch** — ship all 5 improvements together
8. **SharedWorker for SSE** — single SSE connection shared across tabs via BroadcastChannel
9. **URL param filters** — filter state in URL params for bookmarkability and shareability
10. **Expandable sync dropdown** — count in header, click to see per-member progress

## Resolved Questions

1. **SSE connection management:** Use SharedWorker / BroadcastChannel to share a single SSE connection across browser tabs. More efficient than one connection per tab.
2. **Filter persistence:** Filters persisted in URL params (e.g., `?sport=Run&q=morning`). Bookmarkable, shareable, survives page refresh.
3. **Group sync aggregation:** Expandable dropdown — shows "3 members syncing" as a count, click to expand and see per-member progress (e.g., "Alice: 12/45, Bob: 3/20").

## Open Questions

None — all questions resolved during brainstorming.
