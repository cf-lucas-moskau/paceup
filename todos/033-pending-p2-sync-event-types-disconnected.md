---
status: pending
priority: p2
issue_id: "033"
tags: [code-review, typescript, architecture]
dependencies: []
---

# SSE Event Types Disconnected Between Server and Client

## Problem Statement

The server (`services/sync-status.ts`) defines `SyncEvent.data` as `unknown`, while the frontend (`lib/sync.ts`) defines rich discriminated union types (`SyncProgress`, `SyncComplete`, etc.). There is no shared source of truth — if the server changes the shape of an event, the client gets silent `undefined` values.

## Findings

**Server (sync-status.ts:5-8):**
```typescript
export interface SyncEvent {
  type: '...' | '...';
  data: unknown;  // No type safety
}
```

**Client (sync.ts:7-43):** Rich typed interfaces with specific `data` shapes.

## Proposed Solutions

### Solution 1: Create shared types package or file
Move event type definitions to a shared location that both packages import.
- **Effort:** Small
- **Risk:** Low

### Solution 2: Use zod schemas shared between server and client
Define event shapes with zod, export from a shared package.
- **Effort:** Medium
- **Risk:** Low

## Acceptance Criteria

- [ ] Server event broadcasts are type-checked against client expectations
- [ ] Changes to event shapes cause compile-time errors on both sides
