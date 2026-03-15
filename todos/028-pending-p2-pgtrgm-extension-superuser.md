---
status: pending
priority: p2
issue_id: "028"
tags: [code-review, database, migration]
dependencies: []
---

# pg_trgm Extension Migration May Require Superuser

## Problem Statement

Migration `20260314120000_add_activity_name_trigram_index` runs `CREATE EXTENSION IF NOT EXISTS pg_trgm`. On many managed PostgreSQL providers (Neon, Supabase, Railway), this requires the extension to be pre-enabled or the user to have elevated permissions.

## Findings

**Location:** `packages/api/prisma/migrations/20260314120000_add_activity_name_trigram_index/migration.sql`

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

If the deployment target doesn't have `pg_trgm` available, this migration will fail and block all subsequent migrations.

## Proposed Solutions

### Solution 1: Document the requirement
Add a note in README about requiring `pg_trgm` and how to enable it on various providers.
- **Effort:** Trivial
- **Risk:** None

### Solution 2: Make the index optional
Wrap in a conditional or split into a separate, skippable migration.
- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] Migration works on target deployment environment
- [ ] Documented if manual setup is needed
