---
"@adonis-agora/authz": patch
---

Harden the Lucid query-scope adapter (`accessibleBy` / `applyScopeConstraint`) against an `AND`/`OR` precedence trap and tighten identifier validation.

- **Contract clarified (docs + JSDoc):** the query passed to `accessibleBy`/`applyScopeConstraint` MUST NOT have a top-level `orWhere`. Because SQL `AND` binds tighter than `OR`, an appended `AND (scope)` — including a deny-all `1 = 0` — only constrains the last `OR` branch and can leak rows. Knex cannot re-group clauses the caller already added, so the previous "compose freely with other clauses" claim was removed and replaced with the safe patterns: apply the scope first (then add only ANDed filters), or wrap any caller-side OR in its own `.where((q) => q.orWhere(…))` group.
- **Defensive grouping:** the deny-all predicate is now emitted inside its own `where((sub) => sub.whereRaw('1 = 0'))` group, matching the already-grouped AST path, so the scope's own clauses are always a single self-consistent `AND`-group.
- **Tighter identifier guard:** `SAFE_IDENTIFIER` now requires a real, non-empty segment on each side of every dot, so malformed-but-not-injectable identifiers like `a.`, `.a`, and `a..b` are rejected with a clear thrown error instead of producing broken SQL. Existing valid identifiers (`id`, `author_id`, `posts.author_id`) are unchanged.
