---
status: pending
priority: p3
issue_id: "017"
tags: [code-review, quality]
dependencies: []
---

# Navbar uses <a> tags instead of React Router <Link>

## Problem Statement

Navigation links in Navbar.tsx use plain `<a href>` tags instead of React Router's `<Link>` component, causing full page reloads instead of client-side navigation.

## Findings

- **Location:** `packages/web/src/components/Navbar.tsx`
- All nav items use `<a>` tags
- Breaks SPA navigation and flickers the page

## Proposed Solutions

### Option A: Replace <a> with <Link> from react-router-dom
- **Effort:** Small | **Risk:** Low

## Acceptance Criteria

- [ ] All navbar links use `<Link>` or `<NavLink>`
- [ ] Client-side navigation works without page reload
