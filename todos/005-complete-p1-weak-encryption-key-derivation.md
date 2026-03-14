---
status: pending
priority: p1
issue_id: "005"
tags: [code-review, security]
dependencies: []
---

# Weak encryption key derivation — UTF-8 slice instead of proper KDF

## Problem Statement

The encryption key is derived by slicing the first 32 UTF-8 bytes of `TOKEN_ENCRYPTION_KEY`. This is not a proper key derivation function — it uses raw string bytes as key material. If the env var contains a passphrase or low-entropy string, the effective key strength is much less than 256 bits.

**Why it matters:** AES-256-GCM is only as strong as its key. Using raw UTF-8 bytes means the key space is limited to printable ASCII (effectively ~6.5 bits per byte instead of 8).

## Findings

- **Location:** `packages/api/src/lib/encryption.ts:9-13`
- **Code:** `Buffer.from(key.slice(0, 32), 'utf8')` — takes first 32 chars as UTF-8
- Should use HKDF, PBKDF2, or require a hex-encoded 256-bit key

## Proposed Solutions

### Option A: Require hex-encoded 256-bit key in env var
- **Pros:** Simple, proper entropy, no KDF overhead
- **Cons:** Existing data needs re-encryption with new key format
- **Effort:** Small (with migration script)
- **Risk:** Medium (existing encrypted tokens need re-encryption)

### Option B: Add HKDF derivation from passphrase
- **Pros:** Accepts human-readable passphrases safely
- **Cons:** Adds complexity, slight overhead
- **Effort:** Small
- **Risk:** Medium (existing data needs re-encryption)

## Recommended Action

Option A for new deployments. For existing data, add a migration path that re-encrypts with the new key.

## Technical Details

- **Affected files:** `packages/api/src/lib/encryption.ts`

## Acceptance Criteria

- [ ] Key is derived using proper KDF or loaded as hex-encoded bytes
- [ ] Validation rejects keys with insufficient entropy
- [ ] Existing encrypted data can be migrated
- [ ] Key version field in encrypted output incremented for new scheme

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Finding created from code review | Security sentinel flagged |

## Resources

- File: `packages/api/src/lib/encryption.ts:9-13`
