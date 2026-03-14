---
status: pending
priority: p3
issue_id: "018"
tags: [code-review, performance]
dependencies: []
---

# No Vite code splitting configuration

## Problem Statement

Vite config has no `build.rollupOptions.output.manualChunks` — all vendor code ships as one bundle. Libraries like Recharts, date-fns, and @dnd-kit could be split into separate chunks.

## Findings

- **Location:** `packages/web/vite.config.ts:48-50`
- Only `outDir: 'dist'` configured under build
- No chunk splitting strategy

## Proposed Solutions

### Option A: Add manualChunks for large vendor libraries
- **Effort:** Small | **Risk:** Low

## Acceptance Criteria

- [ ] Vendor libraries split into separate chunks
- [ ] Initial page load reduced
