---
status: pending
priority: p3
issue_id: "016"
tags: [code-review, performance]
dependencies: []
---

# Heavy chart library not lazy-loaded

## Problem Statement

Recharts (~400KB) is imported eagerly in pages that show charts. Most users land on Dashboard first and don't need chart components until navigating to activity detail.

## Findings

- Recharts imported at top level in ActivityDetail and potentially other pages
- No `React.lazy()` or dynamic import usage for heavy components

## Proposed Solutions

### Option A: React.lazy() + Suspense for chart pages
- **Effort:** Small | **Risk:** Low

## Acceptance Criteria

- [ ] Chart components lazy-loaded
- [ ] Initial bundle reduced by ~400KB
