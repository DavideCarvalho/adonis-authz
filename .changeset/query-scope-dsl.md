---
"@adonis-agora/authz": minor
---

feat: query-scope DSL for Lucid (accessibleBy) — constrain queries to rows a user may access

Adds an optional, additive query-scope layer that filters a Lucid collection to the rows a user may access for a given action/resource — the `accessibleBy` / Pundit `policy_scope` / Cerbos query-plan concept — applied at the DB layer instead of over-fetch-then-filter. Existing `can`/`hasRole`/`hasAnyRole` behavior is unchanged.

- **ORM-neutral constraint AST** (`@adonis-agora/authz`): `ScopeConstraint` (`scopeAll` / `scopeNone` / condition tree) with builders `eq`, `whereIn`, `where`, `and`, `or`, `normalizeScope`, and the `assertSafeIdentifier` injection guard — ported from nestjs-authz's core scope model.
- **`ScopeRegistry`**: register a scope filter per resource (model class or string name); fail-closed — an unregistered resource is deny-all. Each filter receives the user's effective roles/permissions/tenant (the SAME authz data `can` consults), so it derives its `WHERE` without re-querying.
- **`AuthzService.scope(user, resource, { action?, scope? })`**: resolves the constraint mirroring `can`'s order — super-admin (hook or global role) → wildcard permission grant for the action → registered filter → deny-all.
- **Lucid adapter** (new subpath `@adonis-agora/authz/scope`): `accessibleBy(query, service, user, resource, opts?)` resolves + applies the scope to a Lucid query builder; `applyScopeConstraint(query, constraint)` is the primitive. `allow-all` adds nothing, `deny-all` adds `1 = 0`, conditions compile to parameterized, identifier-safe `where`/`whereIn`/`whereNull` clauses wrapped in their own group so they compose with existing clauses.
- **Config**: `defineConfig({ scopes })` accepts a `ScopeRegistry` or a `(registry) => void` builder; the provider threads it into the container `AuthzService`.
