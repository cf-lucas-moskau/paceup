---
review_agents:
  - kieran-typescript-reviewer
  - security-sentinel
  - performance-oracle
  - architecture-strategist
---

PaceUp is a training-focused running app built as a monorepo (packages/api, packages/web, packages/shared). The API uses Express + Prisma + PostgreSQL with BullMQ workers for Strava sync. The frontend is React + TypeScript with TanStack Query, Recharts, and @dnd-kit. Strava OAuth 2.0 with encrypted tokens and webhook-based activity sync.
