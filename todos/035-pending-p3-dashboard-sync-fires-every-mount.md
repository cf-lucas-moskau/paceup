---
status: pending
priority: p3
issue_id: "035"
tags: [code-review, performance, react]
dependencies: ["025"]
---

# Dashboard Sync Trigger Fires on Every Mount/Navigation

## Problem Statement

`Dashboard.tsx` triggers `triggerSync.mutate()` in a `useEffect(() => {...}, [])`. This fires on every mount — including React StrictMode double-mount in dev and every navigation to/from Dashboard via React Router. Combined with the O(n) job scan in `POST /sync/trigger`, this is wasteful.

## Findings

The server-side 1-hour staleness check provides protection, but the `getJobs` call still executes every time.

## Proposed Solutions

### Solution 1: Track whether sync was already triggered this session
Use a ref or module-level flag:
```typescript
const hasSynced = useRef(false);
useEffect(() => {
  if (user?.isConnected && !hasSynced.current) {
    hasSynced.current = true;
    triggerSync.mutate();
  }
}, [user?.isConnected]);
```
- **Effort:** Trivial
- **Risk:** None

## Acceptance Criteria

- [ ] Sync trigger fires at most once per session, not on every navigation
