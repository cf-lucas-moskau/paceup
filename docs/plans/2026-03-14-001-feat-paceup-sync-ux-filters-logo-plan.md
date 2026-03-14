---
title: "feat: Live Sync Status, Activity Tiers, Filters & Logo"
type: feat
status: active
date: 2026-03-14
deepened: 2026-03-14
origin: docs/brainstorms/2026-03-14-paceup-sync-ux-filters-logo-brainstorm.md
---

# feat: Live Sync Status, Activity Tiers, Filters & Logo

## Enhancement Summary

**Deepened on:** 2026-03-14
**Research agents used:** best-practices-researcher, security-sentinel, architecture-strategist, julik-frontend-races-reviewer, performance-oracle, kieran-typescript-reviewer, Context7 (BullMQ, vite-plugin-pwa), learnings-researcher, spec-flow-analyzer

### Key Improvements from Research
1. Use `@vite-pwa/assets-generator` to auto-generate all icon sizes from a single SVG source
2. Add `pg_trgm` GIN index for efficient `ILIKE` text search instead of sequential scan
3. SSE needs periodic JWT re-verification (every 5 min) for long-lived connections
4. Add mutex/deduplication for concurrent stream fetches on same activity
5. Debounce QueueEvents → SSE broadcasts to prevent event flooding during bulk backfill
6. SharedWorker fallback is the PRIMARY path for iOS/Safari — optimize accordingly
7. Use discriminated union types for SSE events instead of optional fields

### New Considerations Discovered
- `redis.ts` exports a config object, not an ioredis instance — QueueEvents and pub/sub need actual ioredis clients
- Helmet's `noSniff` is fine, but CSP `connect-src` must whitelist the SSE endpoint
- EventSource `withCredentials: true` works for same-origin cookies, but requires explicit CORS `Access-Control-Allow-Credentials: true` on SSE route
- BullMQ QueueEvents creates 1 additional Redis connection per queue (2 total) — document for ops

### Multi-Agent Review Findings (6 agents, 2026-03-14)

**CRITICAL (must address before implementation):**
1. **Shared SyncEvent types** — Backend uses `'syncing'|'complete'|'error'`, frontend uses `'idle'|'syncing'|'error'`. Create a single source of truth discriminated union. The `'complete'` status from server has no frontend representation.
2. **Zombie BroadcastChannel listeners** — React StrictMode double-mounts effects. BroadcastChannel listener in Zustand store must use reference-counted connect/disconnect to prevent zombie subscriptions.
3. **SharedWorker init race** — Worker script loads async; first SSE events may fire before `port.onmessage` is set. Worker must track `lastKnownStatus` and send it to new ports on connect.
4. **JWT not revalidated on long-lived SSE** — Auth middleware only checks JWT once at connection time. Must revalidate every 5 min on heartbeat; close connection if expired.

**HIGH (address during implementation):**
5. **`invalidateQueries` breaks infinite scroll** — Blindly invalidating `['activities']` on sync-complete re-fetches all pages, causing cursor instability and UI jumps. Either invalidate only first page (`refetchPage: (_, idx) => idx === 0`) or show a "New activities available" toast.
6. **Escape ILIKE wildcards** — User-supplied `%` and `_` in search `q` param are SQL wildcards. Escape before passing to Prisma: `q.replace(/%/g, '\\%').replace(/_/g, '\\_')`.
7. **Express `Response` type ambiguity** — `Map<string, Set<Response>>` uses global `Response` (Fetch API), not Express `Response`. Use explicit `import type { Response as ExpressResponse } from 'express'`.
8. **Wrap SSE connections in a class** — Bare `Map<string, Set<Response>>` with module-level `setInterval` is a leak vector. Use an `SSEConnectionManager` class with explicit lifecycle (`addConnection`, `removeConnection`, `broadcastToUser`, `shutdown`).
9. **Streams endpoint ownership check** — Plan mentions extracting stream logic but doesn't explicitly require `activity.userId === req.userId` on the new endpoint. Must verify ownership before returning data.
10. **Backfill N+1 queries** — `backfill-worker.ts` does `findUnique` per activity in a loop. Replace with single `findMany({ where: { stravaActivityId: { in: stravaIds } } })` — reduces 30 queries to 1 per page.

**MEDIUM (implement as part of the work):**
11. **Filter debounce vs URL params timing** — Debounce the query input (local state), not the URL param write. Keep URL as committed source of truth, local `useState` for immediate input. Cancel debounce on unmount.
12. **BroadcastChannel fires during React render** — Batch messages via `requestAnimationFrame` to avoid tearing. Coalesce rapid-fire events into single Zustand update per frame.
13. **EventSource fallback leaks connections** — Safari per-tab fallback must follow same reference-counting as SharedWorker path. `EventSource.close()` in cleanup.
14. **`apiFetch<T>` has no runtime validation** — Generic just casts JSON. Pair with Zod `.parse()` at call sites for SSE event parsing and streams response.
15. **Batch stream upserts** — Current code does 6 sequential upserts. Use `prisma.$transaction([...upserts])` to reduce 6 round trips to 1.
16. **Invalidate group membership cache on join/leave** — Cache TTL of 5 min is too long for newly joined members. Proactively invalidate when membership changes.

**ARCHITECTURE SIMPLIFICATION (from architecture review):**
17. **Consider dropping Redis pub/sub for now** — For single-instance deployment, direct in-process calls from QueueEvents to connection manager are sufficient. Redis pub/sub adds 2 connections and dual-path complexity. Add it only when/if multi-instance is needed.
18. **TanStack Query invalidation from React context** — Don't call `queryClient` from Zustand store (circular dependency risk). Use a `useSyncInvalidation()` hook that bridges Zustand store to `useQueryClient()`.
19. **New `services/` directory as deliberate pattern** — This establishes a new convention (business logic in services, not route handlers). Acknowledge as progress toward deferred Todo 014.

## Overview

Five improvements to PaceUp shipped on a single feature branch: (1) live Strava sync status via SSE with group-wide visibility, (2) transparent activity data auto-fetch with skeleton states, (3) reduced 30-day backfill window, (4) activity list filters with URL persistence, and (5) a text logo with favicon/PWA icons.

## Problem Statement / Motivation

- **No sync visibility:** Users have no idea when activities are being imported. New users see an empty dashboard during backfill with no progress indication. Group coaches cannot tell if an athlete's data is current.
- **Activities all look the same:** Whether an activity has full stream data or just summary data from the list endpoint, the detail page either blocks entirely or shows empty chart sections with no explanation.
- **Slow onboarding:** 6-month backfill imports hundreds of activities most users don't need. This wastes Strava API quota and delays the "first value" moment.
- **No filtering:** The activity list is a flat infinite scroll with no way to search, filter by sport, or narrow by date range.
- **No branding:** Missing favicon, PWA icons, and the navbar shows plain text instead of a branded logo.

## Proposed Solution

All five features on a single branch, implemented in 4 phases: foundation (logo, backfill, streams endpoint), SSE infrastructure, frontend sync UX + filters, and polish.

## Technical Approach

### Architecture

#### SSE Bridge: BullMQ QueueEvents → Redis Pub/Sub → SSE Endpoint

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌─────────────┐
│ BullMQ      │────▶│ QueueEvents  │────▶│ Redis       │────▶│ SSE Route   │
│ Workers     │     │ Listener     │     │ Pub/Sub     │     │ /api/sync   │
│ (activity,  │     │ (completed,  │     │ Channel:    │     │ /events     │
│  backfill)  │     │  progress,   │     │ sync:userId │     │             │
│             │     │  failed)     │     │             │     │ Filters by  │
└─────────────┘     └──────────────┘     └─────────────┘     │ group       │
                                                              │ membership  │
                                                              └──────┬──────┘
                                                                     │ SSE
                                                              ┌──────▼──────┐
                                                              │ SharedWorker│
                                                              │ (or direct  │
                                                              │ EventSource)│
                                                              └──────┬──────┘
                                                                     │ BroadcastChannel
                                                              ┌──────▼──────┐
                                                              │ React Tabs  │
                                                              │ (Navbar     │
                                                              │  SyncStatus)│
                                                              └─────────────┘
```

**Why this architecture:**
- `QueueEvents` listens to BullMQ events via Redis — works even if workers move to separate processes later
- Redis pub/sub per-user channel (`sync:{userId}`) enables efficient event routing without broadcasting everything to every connection
- SSE endpoint resolves the user's group memberships at connection time (cached, refreshed every 5 min) and subscribes to channels for self + all group members
- SharedWorker shares a single SSE connection across tabs; falls back to per-tab EventSource on Safari/iOS

(see brainstorm: docs/brainstorms/2026-03-14-paceup-sync-ux-filters-logo-brainstorm.md — decisions #1, #2, #8, #10)

#### Research Insights: SSE Architecture

**Best Practices (from research agents):**
- Use a single Redis subscriber connection per server instance with pattern subscription (`sync:*`), not one subscriber per user — dramatically reduces Redis connection count
- Debounce QueueEvents → SSE broadcasts: during bulk backfill, `progress` events fire per-job. Batch them into 1 SSE event per second per user to avoid flooding the client
- QueueEvents creates its own Redis connection internally. For 2 queues, that's 2 additional Redis connections. Document for ops monitoring.
- SSE `Last-Event-ID` header: EventSource sends this on reconnection. Include an incrementing event ID so the server can replay missed events (or at minimum, send current state on reconnect)

**Anti-patterns to avoid:**
- Don't create a new ioredis subscriber per SSE connection — this explodes Redis connections
- Don't broadcast all events to all connections and filter client-side — this leaks data (IDOR)
- Don't use `setInterval` per connection for heartbeats — use a single interval that iterates all connections

#### Activity Detail Split: Summary + Streams

```
GET /api/activities/:id          → returns activity summary (instant, from DB)
GET /api/activities/:id/streams  → returns streams (may hit Strava API on first access)
```

This enables the frontend to show the summary card immediately and skeleton charts while streams load.

#### Research Insights: Activity Streams

**Concurrent fetch deduplication:** Add a simple in-memory lock per activityId to prevent duplicate Strava API calls when multiple tabs/users request the same activity's streams simultaneously:

```typescript
// packages/api/src/routes/activities.ts
const fetchingStreams = new Set<string>();

// In the streams endpoint:
if (fetchingStreams.has(activityId)) {
  // Wait for the other request to finish, then return from DB
  await waitForStreamFetch(activityId); // poll DB every 500ms, max 10s
} else {
  fetchingStreams.add(activityId);
  try { /* fetch from Strava */ } finally { fetchingStreams.delete(activityId); }
}
```

**Stream fetch for manual activities with HR:** The current blanket skip for `isManual` activities may miss heart rate data from wearables. Consider: `if (streams.length === 0 && !activity.isManual) || (activity.isManual && activity.hasHeartrate)` to attempt HR stream fetch for manual activities that report heartrate.

#### Activity Filters: Server-Side with URL Params

```
GET /api/activities?q=morning&sport=Run,Ride&startDate=2026-02-01&endDate=2026-03-14&cursor=xxx&limit=20
```

Server-side filtering via Prisma `where` clauses. Frontend uses `useSearchParams()` from React Router to persist filters in URL.

(see brainstorm — decisions #5, #9)

#### Research Insights: Text Search Performance

**Problem:** `WHERE name ILIKE '%query%'` with a leading wildcard cannot use a B-tree index. On a table with thousands of activities per user, this becomes a sequential scan.

**Solution:** Add a PostgreSQL `pg_trgm` GIN index for efficient trigram-based search:

```sql
-- Prisma migration
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_activity_name_trgm ON "Activity" USING GIN (name gin_trgm_ops);
```

This makes `ILIKE '%query%'` use the GIN index instead of a sequential scan. Add this migration in Phase 1.4.

**Alternative (simpler, defer pg_trgm):** At the current scale (hundreds of activities per user), `ILIKE` with the existing `@@index([userId, startDate])` is fast enough — Prisma will filter by userId first (index scan), then apply ILIKE on the small result set. Add `pg_trgm` only if search becomes slow.

### Implementation Phases

#### Phase 1: Foundation (Logo, Backfill, Streams Endpoint)

Independent changes with no cross-dependencies.

- [x] **1.1 Create logo & icons** — `packages/web/public/`
  - Generate SVG text logo "PaceUp" in brand color `#ff6b35` (existing `brand-500`, not `#f97316` from Tailwind defaults)
  - **Use `@vite-pwa/assets-generator`** to auto-generate all sizes from the SVG source:
    ```bash
    npm install -D @vite-pwa/assets-generator
    ```
  - Add `pwa-assets.config.ts`:
    ```typescript
    import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'
    export default defineConfig({
      preset: {
        ...minimal2023Preset,
        maskable: { sizes: [512], padding: 0.1 },
        apple: { sizes: [180], padding: 0.1 },
      },
      images: ['public/logo.svg'],
    })
    ```
  - Update `vite.config.ts` PWA plugin:
    ```typescript
    VitePWA({
      pwaAssets: {
        config: true,
        preset: 'minimal-2023',
        image: 'public/logo.svg',
        htmlPreset: '2023',
        includeHtmlHeadLinks: true,
        overrideManifestIcons: true,
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        // ...existing config...
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    })
    ```
  - Update `packages/web/index.html`:
    ```html
    <link rel="icon" href="/favicon.ico">
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">
    <meta name="theme-color" content="#ff6b35">
    ```
  - Update `packages/web/src/components/Navbar.tsx` brand mark to use SVG logo

- [x] **1.2 Reduce backfill to 30 days** — `packages/api/src/routes/auth.ts`
  - Change line 102: `const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;`
  - Update variable reference on line 108 from `sixMonthsAgo` to `thirtyDaysAgo`
  - **Edge case:** Re-authorizing users (deauth → reauth) become "new users" again and get 30-day backfill. This is correct behavior.

- [x] **1.3 Split activity detail: add streams endpoint** — `packages/api/src/routes/activities.ts`
  - Add `GET /api/activities/:id/streams` route — **place before** `GET /api/activities/:id` (route ordering lesson)
  - Move stream fetch logic (current lines 87-134) into this new route
  - The existing `GET /api/activities/:id` continues to return the activity summary + any already-persisted streams (no Strava API call)
  - **Ownership check required**: `if (!activity || activity.userId !== req.userId) return res.status(404)` — must be present on this new endpoint
  - New endpoint: fetches from Strava if `streams.length === 0 && !activity.isManual`, upserts to DB, returns streams
  - **Add fetch deduplication:** in-memory `Set<string>` of activityIds currently being fetched — second request waits for first to complete
  - **Batch stream upserts**: use `prisma.$transaction([...upserts])` instead of 6 sequential upserts (reduces 6 DB round trips to 1)
  - Return `{ streams: ActivityStream[] }` — on Strava fetch failure, throw and let React Query handle the error state (don't mix error flags in success response)
  - Add Zod validation: `z.object({ id: z.string().cuid() })`

- [x] **1.4 Add filter query params to activities API** — `packages/api/src/routes/activities.ts`
  - Accept optional query params: `q` (string, max 100 chars), `sport` (comma-separated string), `startDate` (ISO string), `endDate` (ISO string)
  - Zod validation:
    ```typescript
    const filterSchema = z.object({
      q: z.string().max(100).optional(),
      sport: z.string().optional(),  // comma-separated, split and validate
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      cursor: z.string().optional(),
      limit: z.coerce.number().min(1).max(50).default(20),
    });
    ```
  - **Escape ILIKE wildcards** in `q` before building Prisma query: `q.replace(/%/g, '\\%').replace(/_/g, '\\_')`
  - Prisma `where` clauses (use `Prisma.ActivityWhereInput` return type for compile-time safety):
    - `q`: `name: { contains: escapedQ, mode: 'insensitive' }`
    - `sport`: `sportType: { in: sport.split(',') }`
    - `startDate`/`endDate`: `startDate: { gte: new Date(startDate), lte: new Date(endDate) }`
  - **Cursor invalidation**: when filters change, the frontend sends a new query key (no cursor), so Prisma starts fresh. Document this in the API.

#### Phase 2: SSE Infrastructure

- [x] **2.1 Create Redis clients for pub/sub** — `packages/api/src/lib/redis.ts`
  - `redis.ts` currently exports a config object, not ioredis instances. Add:
    ```typescript
    import Redis from 'ioredis';
    export const redisPublisher = new Redis(redisUrl);
    export const redisSubscriber = new Redis(redisUrl);
    ```
  - These are needed for pub/sub (QueueEvents uses its own connections internally)

- [x] **2.2 Create SSE service module** — `packages/api/src/services/sync-status.ts`
  - **Wrap in `SSEConnectionManager` class** with explicit lifecycle (not bare module-level Map)
  - Use `import type { Response as ExpressResponse } from 'express'` (not global Fetch API `Response`)
  - Connection manager: `Map<string, Set<ExpressResponse>>` mapping userId → active SSE response objects
  - `addConnection(userId, res)` / `removeConnection(userId, res)`
  - `getGroupMemberships(userId): Promise<string[]>` — returns group member userIds; cached 5 min via simple in-memory TTL cache. **Expose `clearCacheForUser(userId)`** to proactively invalidate on group join/leave (call from group membership endpoints).
  - `broadcastToUser(userId, event)` — sends SSE event to all connections for this user
  - `broadcastToGroupMembers(userId, event)` — resolves user's groups, sends to all members' connections
  - Max 5 SSE connections per user (enforced in `addConnection`, return 429 if exceeded)
  - **Single heartbeat interval** (not per-connection): one `setInterval(30_000)` that iterates all connections and writes `:keepalive\n\n`
  - Graceful shutdown: export `closeAllConnections()` function
  - **JWT re-verification**: every 5 minutes (piggyback on heartbeat), verify the user's JWT is still valid. If expired, send `event: auth-expired` and close connection.
  - SSE write helper:
    ```typescript
    function sendSSE(res: Response, event: string, data: unknown, id?: string): void {
      res.write(`id: ${id ?? Date.now()}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }
    ```

- [x] **2.3 Create QueueEvents listener** — `packages/api/src/services/sync-events.ts`
  - Instantiate `QueueEvents` for both `activity-sync` and `activity-backfill` queues
  - **BullMQ QueueEvents API** (confirmed via Context7):
    ```typescript
    import { QueueEvents } from 'bullmq';
    const activityEvents = new QueueEvents('activity-sync', { connection: redisConnection });
    const backfillEvents = new QueueEvents('activity-backfill', { connection: redisConnection });

    activityEvents.on('progress', ({ jobId, data }) => { /* data from job.updateProgress() */ });
    activityEvents.on('completed', ({ jobId, returnvalue }) => { /* job finished */ });
    activityEvents.on('failed', ({ jobId, failedReason }) => { /* job failed */ });
    ```
  - **Debounce broadcasts**: during bulk backfill, `progress` events fire per-job. Collect events per-user and emit at most 1 SSE update per second per user using a debounce buffer.
  - On each event: extract `userId` from job data, compute aggregate sync status (active jobs, completed, total), publish via `broadcastToGroupMembers()`
  - **Cleanup**: `await activityEvents.close()` and `await backfillEvents.close()` during graceful shutdown

- [x] **2.4 Add BullMQ job progress reporting** — `packages/api/src/queues/activity-worker.ts`, `backfill-worker.ts`
  - In activity worker: `await job.updateProgress({ userId, status: 'fetching', stravaActivityId })` before Strava API call, and `await job.updateProgress({ userId, status: 'complete', stravaActivityId })` after
  - In backfill worker: `await job.updateProgress({ userId, page, activitiesFound, status: 'backfilling' })` per page
  - **Fix backfill N+1**: Replace per-activity `findUnique` loop with single `findMany({ where: { stravaActivityId: { in: stravaIds } } })` — reduces 30 queries to 1 per page

- [x] **2.5 Create SSE route** — `packages/api/src/routes/sync-status.ts`
  - `GET /api/sync/events` — authenticated (uses `authenticate` middleware)
  - Set headers:
    ```typescript
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',  // nginx
      'Access-Control-Allow-Credentials': 'true',
    });
    res.flushHeaders();
    ```
  - **Helmet exemption**: Mount SSE route BEFORE `app.use(helmet())` in `index.ts`, or use `helmet({ contentSecurityPolicy: { directives: { connectSrc: ["'self'"] } } })`
  - **Rate limiter exemption**: Do NOT apply `apiLimiter` to this route. Add separate connection limiter:
    ```typescript
    // Max 1 new SSE connection per 10 seconds per IP
    const sseLimiter = rateLimit({ windowMs: 10_000, max: 1, keyGenerator: (req) => req.ip });
    ```
  - On connection: authenticate, send initial state (`event: init` with current sync status), start heartbeat
  - On `req.on('close')`: remove connection, unsubscribe from Redis channels, log
  - Mount in `index.ts` BEFORE `app.use('/api', apiLimiter)` — this ensures it's not rate-limited by the API limiter
  - **SSE event types** (discriminated union):
    ```
    event: sync-progress
    data: {"userId":"abc","name":"Alice","status":"syncing","completed":12,"total":45,"type":"backfill"}

    event: sync-complete
    data: {"userId":"abc","name":"Alice","activitiesAdded":3}

    event: sync-error
    data: {"userId":"abc","name":"Alice","error":"Rate limited by Strava"}

    event: init
    data: {"connectedUsers":[{"userId":"abc","name":"Alice","status":"idle"}]}
    ```

- [x] **2.6 Update Vite proxy for SSE** — `packages/web/vite.config.ts`
  - Add proxy config for `/api/sync` with buffering disabled:
    ```typescript
    '/api/sync': {
      target: 'http://localhost:3000',
      changeOrigin: true,
      configure: (proxy) => {
        proxy.on('proxyRes', (proxyRes) => {
          proxyRes.headers['cache-control'] = 'no-cache';
          delete proxyRes.headers['content-length'];
        });
      },
    },
    ```

- [x] **2.7 Handle deauth + graceful shutdown** — `packages/api/src/routes/webhooks.ts`, `index.ts`
  - In webhook deauth handler: send `event: deauthorized` then close SSE connections for user
  - In graceful shutdown (order matters):
    1. Send `event: server-shutdown` to all SSE connections
    2. Close all SSE connections (call `closeAllConnections()`)
    3. Close QueueEvents listeners (`await activityEvents.close()`)
    4. Close Redis pub/sub subscribers
    5. Close BullMQ workers (existing)
    6. Close HTTP server

#### Phase 3: Frontend — Sync UX + Filters

- [x] **3.1 Create SharedWorker for SSE** — `packages/web/public/sync-worker.js`
  - Plain JS file (SharedWorker cannot be a module in all browsers)
  - Opens `EventSource('/api/sync/events', { withCredentials: true })`
  - Distributes events to all connected ports via `BroadcastChannel('paceup-sync')`
  - Auto-reconnects on error with exponential backoff (1s, 2s, 4s, max 30s)
  - **Reconnection with Last-Event-ID**: EventSource automatically sends `Last-Event-ID` header on reconnect
  - Track connected ports; when last port disconnects, close EventSource
  - **Race condition prevention**: Use a `connecting` flag to prevent multiple simultaneous EventSource creation
  - **Track `lastKnownStatus`** in worker — send to new ports on connect to prevent init race (worker loads async; first SSE events may fire before port.onmessage is ready)
  - **Reset reconnect backoff on new port connect** — if user opens a new tab while backoff is at 15s, reset to 1s for better UX

  ```javascript
  // sync-worker.js (SharedWorker)
  const channel = new BroadcastChannel('paceup-sync');
  let eventSource = null;
  let ports = [];
  let reconnectDelay = 1000;
  let lastKnownStatus = null; // Track for new port init

  function connect() {
    if (eventSource) return;
    eventSource = new EventSource('/api/sync/events', { withCredentials: true });

    eventSource.addEventListener('sync-progress', (e) => {
      const data = JSON.parse(e.data);
      lastKnownStatus = { type: 'sync-progress', data };
      channel.postMessage(lastKnownStatus);
    });
    eventSource.addEventListener('sync-complete', (e) => {
      const data = JSON.parse(e.data);
      lastKnownStatus = { type: 'sync-complete', data };
      channel.postMessage(lastKnownStatus);
    });
    eventSource.addEventListener('sync-error', (e) => {
      const data = JSON.parse(e.data);
      lastKnownStatus = { type: 'sync-error', data };
      channel.postMessage(lastKnownStatus);
    });
    eventSource.addEventListener('init', (e) => {
      const data = JSON.parse(e.data);
      lastKnownStatus = { type: 'init', data };
      channel.postMessage(lastKnownStatus);
    });

    eventSource.onopen = () => { reconnectDelay = 1000; };
    eventSource.onerror = () => {
      eventSource.close();
      eventSource = null;
      setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 30000);
    };
  }

  onconnect = (e) => {
    const port = e.ports[0];
    ports.push(port);
    // Reset backoff on new port (user is actively interested)
    if (reconnectDelay > 2000) reconnectDelay = 1000;
    connect();
    // Send last known status to new port (prevents init race)
    if (lastKnownStatus) port.postMessage(lastKnownStatus);
    port.onmessage = (msg) => {
      if (msg.data === 'disconnect') {
        ports = ports.filter(p => p !== port);
        if (ports.length === 0 && eventSource) {
          eventSource.close();
          eventSource = null;
        }
      }
    };
  };
  ```

- [x] **3.2 Create useSyncStatus hook** — `packages/web/src/lib/sync.ts`
  - Zustand store for sync state:
    ```typescript
    interface SyncProgress {
      type: 'sync-progress';
      userId: string;
      name: string;
      status: 'syncing';
      completed: number;
      total: number;
      syncType: 'backfill' | 'webhook' | 'reconciliation';
    }
    interface SyncComplete {
      type: 'sync-complete';
      userId: string;
      name: string;
      activitiesAdded: number;
    }
    interface SyncError {
      type: 'sync-error';
      userId: string;
      name: string;
      error: string;
    }
    type SyncEvent = SyncProgress | SyncComplete | SyncError;

    interface SyncStore {
      statuses: Record<string, SyncProgress | SyncComplete | SyncError>;
      isConnected: boolean;
      setStatus: (userId: string, event: SyncEvent) => void;
      setConnected: (connected: boolean) => void;
    }
    ```
  - **Use `Record<string, T>` instead of `Map<string, T>`** — Maps don't trigger Zustand re-renders properly. Use plain objects.
  - **Reference-counted connect/disconnect** — Do NOT set up BroadcastChannel inside Zustand `create()`. Use a `connectSync(store)`/`disconnectSync()` pattern with a ref counter. When last component unmounts, close the channel. Prevents zombie listeners in React StrictMode.
  - On mount: try SharedWorker, fall back to direct EventSource (same reference-counting for both paths)
  - **Cleanup on unmount**: send 'disconnect' to SharedWorker port, or `EventSource.close()` for fallback
  - **Batch BroadcastChannel messages**: Process via `requestAnimationFrame` to avoid Zustand updates during React render (prevents tearing)
  - **Query invalidation from React context** — Do NOT call `queryClient` from Zustand store (circular dependency). Create a `useSyncInvalidation()` hook that watches Zustand state via `useSyncStore.subscribe()` and calls `useQueryClient().invalidateQueries()` from within the React tree.
  - **On sync-complete**: invalidate only first page to avoid cursor instability: `queryClient.invalidateQueries({ queryKey: ['activities'], refetchPage: (_, idx) => idx === 0 })`

- [x] **3.3 Create SyncStatusIndicator component** — `packages/web/src/components/SyncStatusIndicator.tsx`
  - Uses `useSyncStatus()` hook
  - **Idle state**: green dot + "Synced" (subtle, no dropdown)
  - **Syncing state**: animated spinner + "3 syncing" + clickable to expand dropdown
  - **Dropdown**: per-member progress bars (e.g., "Alice: 12/45 activities", "You: Synced")
  - **Error state**: red dot + "Sync error" with retry hint
  - Place in Navbar between NotificationBell and avatar
  - **Accessibility**: `aria-live="polite"` on the status text, `role="status"`, dropdown uses `aria-expanded`

- [x] **3.4 Update ActivityDetail for partial loading** — `packages/web/src/pages/ActivityDetail.tsx`
  - Add `useActivityStreams(id)` hook in `hooks.ts`:
    ```typescript
    export function useActivityStreams(id: string) {
      return useQuery({
        queryKey: ['activity-streams', id],
        queryFn: () => apiFetch<{ streams: { id: string; streamType: string; data: unknown }[] }>(`/activities/${id}/streams`),
        enabled: !!id,
        staleTime: 5 * 60 * 1000, // Streams don't change — cache for 5 min
        retry: 1, // Only retry once for Strava API failures
      });
    }
    ```
  - Render summary card immediately from `useActivity(id)` (distance, duration, pace, elevation, HR summary)
  - Render chart sections with **fixed-height** skeleton states (`animate-pulse` placeholders matching actual chart dimensions, e.g., `h-[250px]`) to prevent cumulative layout shift when charts load
  - If `useActivityStreams` `isError`, show "Unable to load chart data" with a "Retry" button that calls `refetch()` (use React Query error state, not error flags in response)
  - If streams are empty and `isManual: true`, show "Manual activity — no GPS/stream data available"

- [x] **3.5 Build activity filter bar** — `packages/web/src/pages/Activities.tsx`
  - Add filter bar above the activity list:
    - **Search input**: text input with magnifying glass icon, **300ms debounce using `useRef` + `setTimeout`** (not `useDeferredValue` which doesn't debounce network requests)
    - **Sport type select**: `@radix-ui/react-select` dropdown with hardcoded common types: Run, TrailRun, VirtualRun, Ride, Swim, Walk, Hike + "All" default
    - **Date range**: two `<input type="date">` (start/end) with presets dropdown ("Last 7 days", "Last 30 days", "This month", "All time")
    - **Clear filters** button (visible when any filter is active)
  - Use `useSearchParams()` from React Router:
    ```typescript
    const [searchParams, setSearchParams] = useSearchParams();
    const q = searchParams.get('q') || '';
    const sport = searchParams.get('sport') || '';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    ```
  - URL param format: `?q=morning&sport=Run,Ride&startDate=2026-02-01&endDate=2026-03-14`
  - Update `useActivities` hook to accept filter params and include them in **both** query key and API URL:
    ```typescript
    export function useActivities(filters?: { q?: string; sport?: string; startDate?: string; endDate?: string }, limit = 20) {
      return useInfiniteQuery({
        queryKey: ['activities', limit, filters],
        queryFn: ({ pageParam }) => {
          const params = new URLSearchParams();
          params.set('limit', String(limit));
          if (pageParam) params.set('cursor', pageParam);
          if (filters?.q) params.set('q', filters.q);
          if (filters?.sport) params.set('sport', filters.sport);
          if (filters?.startDate) params.set('startDate', filters.startDate);
          if (filters?.endDate) params.set('endDate', filters.endDate);
          return apiFetch<{ activities: ActivitySummary[]; nextCursor: string | null }>(`/activities?${params}`);
        },
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      });
    }
    ```
  - **When filters change**, the new query key triggers a fresh fetch (cursor resets automatically)
  - **Empty state with filters**: "No activities match your filters" + "Clear filters" button
  - **Race condition**: Debounced search + cursor pagination — ensure the debounce timer is cleared when component unmounts or filter changes

- [x] **3.6 Invalidate activity list on sync completion** — `packages/web/src/hooks/useSyncInvalidation.ts`
  - Create a `useSyncInvalidation()` hook (not in Zustand store — avoids circular dependency with queryClient):
    ```typescript
    export function useSyncInvalidation() {
      const queryClient = useQueryClient();
      useEffect(() => {
        const unsub = useSyncStore.subscribe((state, prevState) => {
          // Detect new sync-complete events, invalidate only first page
          queryClient.invalidateQueries({
            queryKey: ['activities'],
            refetchPage: (_, idx) => idx === 0,
          });
        });
        return unsub;
      }, [queryClient]);
    }
    ```
  - Call `useSyncInvalidation()` in `SyncStatusIndicator` component (or `App.tsx`)
  - This respects active filters — TanStack Query refetches with current filter params
  - Invalidating only first page prevents cursor instability on infinite scroll

#### Phase 4: Polish & Integration

- [ ] **4.1 Test SSE with multiple tabs**
  - Verify SharedWorker shares connection (check Network tab — should be 1 SSE connection)
  - Verify fallback works in Safari (should create per-tab EventSource, max 5 connections)
  - Verify sync status updates appear in all tabs simultaneously
  - Test: close all tabs except one → SSE still works
  - Test: open 6+ tabs → 6th should not create another SSE connection (SharedWorker shares 1)

- [ ] **4.2 Test filters with pagination**
  - Apply filter → verify cursor resets (no stale data from previous filter)
  - Load more → change filter → verify list resets to first page
  - Verify URL params survive page refresh
  - Verify back/forward navigation preserves filter state
  - Type in search, immediately click sport filter → verify no race condition
  - Clear filters → verify returns to unfiltered list

- [ ] **4.3 Test backfill experience for new user**
  - Sign up with Strava → verify 30-day backfill starts (not 6 months)
  - Verify SSE shows backfill progress in real-time ("Syncing 5/30 activities...")
  - Verify activities appear in list as they're imported (list refreshes on sync-complete)
  - Test with slow network: verify heartbeat keeps connection alive

- [ ] **4.4 Test activity detail partial loading**
  - Open activity without streams → summary card shows immediately, charts show skeleton
  - Streams load → charts render with smooth transition
  - Strava API fails → error banner with "Retry" button → click retry → refetches
  - Manual activity → "No GPS data" message instead of empty charts
  - Open same activity in 2 tabs simultaneously → verify only 1 Strava API call (dedup)

- [ ] **4.5 Verify PWA install**
  - Check favicon shows in browser tab
  - Check Apple Touch Icon on iOS "Add to Home Screen" (180x180)
  - Check PWA install on Android (192x192 and 512x512 icons)
  - Verify maskable icon (512px with `purpose: 'any maskable'`)
  - Run Lighthouse PWA audit — should pass installability criteria

## System-Wide Impact

### Interaction Graph

- SSE endpoint → `authenticate` middleware → cookie JWT verification
- BullMQ `QueueEvents` listener → sync-events service → broadcastToGroupMembers → SSE connections
- Activity worker `job.updateProgress()` → QueueEvents `progress` event → debounce buffer → sync-status broadcast
- Backfill worker `job.updateProgress()` → QueueEvents `progress` event → debounce buffer → sync-status broadcast
- Webhook deauth handler → sync-status service → close SSE connections for user → delete activities
- `sync-complete` SSE event → frontend Zustand subscribe → `queryClient.invalidateQueries(['activities'])` → refetch with current filters
- Filter URL params → `useSearchParams()` → `useActivities(filters)` → `GET /api/activities?q=...&sport=...`

### Error & Failure Propagation

- **SSE connection drop**: EventSource auto-reconnects with `Last-Event-ID`. SharedWorker handles reconnection; tabs receive events through BroadcastChannel. Server sends `event: init` with current state on reconnect.
- **Strava stream fetch failure**: `activities/:id/streams` returns `streamsError: true` instead of swallowing error. Frontend shows "Unable to load chart data" with retry button.
- **Redis pub/sub failure**: QueueEvents loses connection → SSE stops receiving events. QueueEvents has built-in reconnection. Log error, and SSE clients will see "connection" go stale (heartbeat continues, but no sync events).
- **Rate limiter conflict**: SSE exempt from `apiLimiter`. Separate connection limiter (5 connections/user). EventSource reconnection backoff prevents flood.
- **JWT expiry on long-lived SSE**: Periodic JWT verification (every 5 min). If expired, send `event: auth-expired` and close. Frontend redirects to login.

### State Lifecycle Risks

- **SSE connection state**: In-memory `Map<string, Set<Response>>`. If server crashes, all connections lost — clients auto-reconnect and receive `event: init` with current state. No persistent state at risk.
- **Group membership cache**: 5-min TTL in memory. If user leaves a group, they continue receiving that group's events for up to 5 minutes. Acceptable tradeoff. If user joins a group, they won't see that group's sync until cache refreshes (or reconnect).
- **Concurrent stream fetch**: Deduplicated via in-memory `Set<string>`. Prisma `upsert` as backup prevents duplicate DB rows.
- **Filter + sync race**: If filters are active and a non-matching activity syncs, `queryClient.invalidateQueries(['activities'])` will refetch with filters — the non-matching activity won't appear in the filtered list. Correct behavior.

### API Surface Parity

| Endpoint | Change |
|---|---|
| `GET /api/activities` | Add `q`, `sport`, `startDate`, `endDate` query params |
| `GET /api/activities/:id` | No longer fetches streams from Strava (returns only DB data) |
| `GET /api/activities/:id/streams` | **NEW** — fetches streams on demand, with deduplication |
| `GET /api/sync/events` | **NEW** — SSE endpoint with `init`, `sync-progress`, `sync-complete`, `sync-error` events |

### Integration Test Scenarios

1. **New user backfill + SSE**: OAuth complete → SSE connects → receives `event: init` → backfill starts → `sync-progress` events update header → `sync-complete` fires → activities list refreshes
2. **Filter + pagination + new sync**: Apply sport=Run filter → load 2 pages → new Run activity syncs → `sync-complete` → list refetches with filter → new Run appears at top; non-matching Ride does NOT appear
3. **Multi-tab SharedWorker**: Open 3 tabs → verify 1 SSE connection in Network tab → trigger sync → all 3 tabs update → close 2 tabs → remaining tab still works → open new tab → gets init state immediately
4. **Activity detail partial load**: Open activity → summary renders in <200ms → streams skeleton → streams load from Strava → charts animate in; Open same activity in another tab → no duplicate Strava API call
5. **SSE + deauthorization**: User connected with SSE → admin deauthorizes in Strava → webhook fires → SSE sends `event: deauthorized` → connection closes → frontend shows "Strava disconnected" state
6. **SSE reconnection**: Kill server → restart → EventSource auto-reconnects → sends `Last-Event-ID` → server sends `event: init` with current state → client is up-to-date

## Acceptance Criteria

### Functional Requirements

- [ ] SSE endpoint streams sync status events to authenticated users
- [ ] Navbar shows sync progress with expandable per-member dropdown
- [ ] Group members see each other's sync status in real time
- [ ] SharedWorker shares SSE connection across tabs; fallback works on Safari
- [ ] Activity detail shows summary card immediately, charts load separately with skeletons
- [ ] Failed stream fetch shows error with retry button
- [ ] Backfill imports last 30 days (not 6 months) for new users
- [ ] Activity list supports text search, sport type filter, and date range filter
- [ ] Filters persist in URL search params
- [ ] Empty state with filters shows "No activities match" + clear button
- [ ] Favicon, PWA icons (192, 512, apple-touch-icon), and navbar logo all use brand mark
- [ ] SSE connections cleaned up on server shutdown and user deauthorization

### Non-Functional Requirements

- [ ] SSE heartbeat every 30 seconds to prevent proxy timeouts
- [ ] Max 5 SSE connections per user
- [ ] Text search debounced at 300ms
- [ ] SSE endpoint exempt from API rate limiter
- [ ] Vite dev proxy supports SSE streaming (no buffering)
- [ ] JWT re-verified every 5 minutes on SSE connections
- [ ] QueueEvents → SSE broadcasts debounced to max 1 per second per user
- [ ] Streams staleTime set to 5 min (streams don't change)

## Success Metrics

- New users see sync progress within 2 seconds of landing on dashboard
- Activity detail summary card renders in <200ms (no Strava API dependency)
- Filter changes reflect in URL and API within 300ms
- PWA install shows correct icon on all platforms
- Lighthouse PWA audit passes installability criteria

## Dependencies & Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| SharedWorker not supported (Safari <16, iOS) | **High** | Medium | Fallback to per-tab EventSource is the **primary** path for iOS PWA users. Optimize for fallback, not SharedWorker. Connection limiter accommodates 5 per user. |
| helmet() blocks SSE Content-Type | Medium | High | Mount SSE route BEFORE helmet middleware in index.ts |
| Vite proxy buffers SSE in dev | Medium | Medium | Configure proxy to disable buffering (Phase 2.6) |
| ILIKE text search slow at scale | Low (current) | Medium (future) | At current scale, userId index narrows result set. Add `pg_trgm` GIN index if search degrades. |
| Strava API rate limit during backfill blocks stream fetch | Low | Medium | Existing priority system: user-triggered stream fetch (priority 'user') outranks backfill (priority 'backfill') |
| Brand color mismatch (`#f97316` vs `#ff6b35`) | N/A | Resolved | Use existing `#ff6b35` (`brand-500`) throughout |
| QueueEvents Redis connections | Low | Low | 2 additional Redis connections (1 per queue). Document for ops. |
| SSE event flood during bulk backfill | Medium | Medium | Debounce buffer: max 1 SSE broadcast per user per second |

## New Files

| File | Purpose |
|---|---|
| `packages/api/src/services/sync-status.ts` | SSE connection manager + group membership cache + heartbeat |
| `packages/api/src/services/sync-events.ts` | BullMQ QueueEvents → debounce → SSE bridge |
| `packages/api/src/routes/sync-status.ts` | SSE HTTP endpoint (`GET /api/sync/events`) |
| `packages/web/public/sync-worker.js` | SharedWorker for SSE connection sharing |
| `packages/web/src/lib/sync.ts` | Zustand store + useSyncStatus hook + query invalidation |
| `packages/web/src/components/SyncStatusIndicator.tsx` | Navbar sync status UI with dropdown |
| `packages/web/public/logo.svg` | SVG logo source (used by @vite-pwa/assets-generator) |
| `packages/web/pwa-assets.config.ts` | PWA asset generator config |

## Modified Files

| File | Change |
|---|---|
| `packages/api/src/index.ts` | Mount SSE route BEFORE helmet, update graceful shutdown sequence |
| `packages/api/src/lib/redis.ts` | Add `redisPublisher` and `redisSubscriber` ioredis instances |
| `packages/api/src/routes/auth.ts` | Change 6-month to 30-day backfill |
| `packages/api/src/routes/activities.ts` | Add filter params with Zod, extract streams to separate endpoint with dedup |
| `packages/api/src/routes/webhooks.ts` | Close SSE on deauth |
| `packages/api/src/queues/activity-worker.ts` | Add `job.updateProgress()` calls |
| `packages/api/src/queues/backfill-worker.ts` | Add `job.updateProgress()` calls |
| `packages/web/src/components/Navbar.tsx` | Add SyncStatusIndicator, update logo to SVG |
| `packages/web/src/pages/ActivityDetail.tsx` | Split into summary + streams with skeletons |
| `packages/web/src/pages/Activities.tsx` | Add filter bar with debounced search, date range, sport select |
| `packages/web/src/lib/hooks.ts` | Add `useActivityStreams`, update `useActivities` with filter params |
| `packages/web/vite.config.ts` | Update PWA config with `pwaAssets`, add SSE proxy |
| `packages/web/index.html` | Add favicon, apple-touch-icon, theme-color meta tags |
| `packages/web/package.json` | Add `@vite-pwa/assets-generator` devDependency |

## Sources & References

### Origin

- **Brainstorm document:** [docs/brainstorms/2026-03-14-paceup-sync-ux-filters-logo-brainstorm.md](docs/brainstorms/2026-03-14-paceup-sync-ux-filters-logo-brainstorm.md) — Key decisions carried forward: SSE over WebSocket/polling, SharedWorker for tab sharing, URL param filters, expandable sync dropdown, 30-day backfill, single branch delivery.

### Internal References

- SSE security patterns: `docs/solutions/security-issues/paceup-multi-agent-code-review-21-fixes.md` — IDOR prevention, route ordering, Zod validation, rate limiting tiers
- Express server: `packages/api/src/index.ts` — route mounting, middleware order, graceful shutdown
- BullMQ queues: `packages/api/src/queues/index.ts` — queue config, connection setup
- Activity worker: `packages/api/src/queues/activity-worker.ts` — job processing, upsert pattern
- Backfill worker: `packages/api/src/queues/backfill-worker.ts` — pagination, priority 3
- Activity routes: `packages/api/src/routes/activities.ts` — current stream fetch logic (lines 87-134)
- Auth flow: `packages/api/src/routes/auth.ts` — backfill trigger (line 100-112)
- Navbar: `packages/web/src/components/Navbar.tsx` — current layout, NotificationBell placement
- Activity detail: `packages/web/src/pages/ActivityDetail.tsx` — chart rendering, stream processing
- Activities page: `packages/web/src/pages/Activities.tsx` — infinite scroll, current empty state
- Hooks: `packages/web/src/lib/hooks.ts` — useActivities, useActivity patterns
- Vite config: `packages/web/vite.config.ts` — PWA manifest, proxy config
- Rate limiter: `packages/api/src/lib/rate-limiter.ts` — existing tiers
- Redis config: `packages/api/src/lib/redis.ts` — connection config (object, not instance)

### External References (Context7)

- BullMQ QueueEvents API: `completed`, `failed`, `progress`, `active`, `waiting` events with `{ jobId, data/returnvalue/failedReason }`
- vite-plugin-pwa `pwaAssets` config with `@vite-pwa/assets-generator` for auto-generating icons from SVG
- PWA minimal requirements: favicon, apple-touch-icon (180x180), theme-color meta, manifest icons with `purpose: 'any maskable'`

### Institutional Learnings Applied

- **Route ordering**: Literal routes before parameterized (notification route bug). SSE route mounted first.
- **IDOR prevention**: Filter SSE events by actual group membership server-side, not client-provided group IDs.
- **Zod at boundaries**: Validate all new endpoint params (filter schema, stream endpoint) with Zod schemas.
- **Keep handlers thin**: SSE logic in service module (`sync-status.ts`), not in route file. Prepares for deferred service layer extraction (Todo 014).
- **Rate limiter per concern**: Separate SSE connection limiter from API request limiter.
- **BigInt serialization**: Already handled globally — SSE event payloads with activity IDs will serialize correctly.
