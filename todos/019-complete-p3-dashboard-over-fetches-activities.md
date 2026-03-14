---
status: pending
priority: p3
issue_id: "019"
tags: [code-review, performance]
dependencies: []
---

# Dashboard over-fetches paginated activities to show 5

## Problem Statement

Dashboard calls `useActivities()` which fetches a full page of activities (default 20) via infinite query, then slices to show only 5: `activitiesData?.pages?.[0]?.activities?.slice(0, 5)`.

## Findings

- **Location:** `packages/web/src/pages/Dashboard.tsx:19`
- Wastes bandwidth fetching 20 activities to display 5
- Could use a dedicated `limit=5` param or a separate lightweight endpoint

## Proposed Solutions

### Option A: Add limit param to useActivities hook
- **Effort:** Small | **Risk:** Low

## Acceptance Criteria

- [ ] Dashboard fetches only 5 activities
