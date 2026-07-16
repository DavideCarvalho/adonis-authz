# @adonis-agora/authz

## 0.4.3

### Patch Changes

- [`bf741c1`](https://github.com/DavideCarvalho/adonis-authz/commit/bf741c1af40f10613d66f9c59358432ca2976e10) - Corrige a leitura das global roles do contexto: `globalRoleGrants` e o super-admin por role
  global voltam a funcionar.

  O bridge lia `accessor.get('globalRoles')`, mas o accessor do `@adonis-agora/context` implementava
  só `get()` (o store inteiro) — a chave era ignorada e vinha o store, o `Array.isArray` falhava, e
  `globalRolesFromContext()` devolvia `[]`. Resultado: toda permissão concedida por global role
  negava, em silêncio. Agora o bridge lê `get()` e indexa a chave localmente, o que funciona com
  qualquer versão do context (a forma sem argumento sempre existiu).

  Os testes do bridge falseavam `get(key) => valor` e `get() => valor-desembrulhado` — dois contratos
  que o context nunca shippou. Reescritos para a forma real (`get() => store`), que é o que deixava o
  bug invisível.

## 0.4.2

### Patch Changes

- [`0354acc`](https://github.com/DavideCarvalho/adonis-authz/commit/0354acc724ffcc5e0e1767247dfd42b2e78863e4) - fix: sync VERSION literal via sync-version guard

## 0.4.1

### Patch Changes

- [`c0c6a38`](https://github.com/DavideCarvalho/adonis-authz/commit/c0c6a38823a278d66f0731e0320e919dc2620d3e) - Harden the Lucid query-scope adapter (`accessibleBy` / `applyScopeConstraint`) against an `AND`/`OR` precedence trap and tighten identifier validation.

  - **Contract clarified (docs + JSDoc):** the query passed to `accessibleBy`/`applyScopeConstraint` MUST NOT have a top-level `orWhere`. Because SQL `AND` binds tighter than `OR`, an appended `AND (scope)` — including a deny-all `1 = 0` — only constrains the last `OR` branch and can leak rows. Knex cannot re-group clauses the caller already added, so the previous "compose freely with other clauses" claim was removed and replaced with the safe patterns: apply the scope first (then add only ANDed filters), or wrap any caller-side OR in its own `.where((q) => q.orWhere(…))` group.
  - **Defensive grouping:** the deny-all predicate is now emitted inside its own `where((sub) => sub.whereRaw('1 = 0'))` group, matching the already-grouped AST path, so the scope's own clauses are always a single self-consistent `AND`-group.
  - **Tighter identifier guard:** `SAFE_IDENTIFIER` now requires a real, non-empty segment on each side of every dot, so malformed-but-not-injectable identifiers like `a.`, `.a`, and `a..b` are rejected with a clear thrown error instead of producing broken SQL. Existing valid identifiers (`id`, `author_id`, `posts.author_id`) are unchanged.

## 0.4.0

### Minor Changes

- [`a30bb78`](https://github.com/DavideCarvalho/adonis-authz/commit/a30bb78cc610be7613ba62e21dd7bf6592d2b179) - feat: query-scope DSL for Lucid (accessibleBy) — constrain queries to rows a user may access

  Adds an optional, additive query-scope layer that filters a Lucid collection to the rows a user may access for a given action/resource — the `accessibleBy` / Pundit `policy_scope` / Cerbos query-plan concept — applied at the DB layer instead of over-fetch-then-filter. Existing `can`/`hasRole`/`hasAnyRole` behavior is unchanged.

  - **ORM-neutral constraint AST** (`@adonis-agora/authz`): `ScopeConstraint` (`scopeAll` / `scopeNone` / condition tree) with builders `eq`, `whereIn`, `where`, `and`, `or`, `normalizeScope`, and the `assertSafeIdentifier` injection guard — ported from nestjs-authz's core scope model.
  - **`ScopeRegistry`**: register a scope filter per resource (model class or string name); fail-closed — an unregistered resource is deny-all. Each filter receives the user's effective roles/permissions/tenant (the SAME authz data `can` consults), so it derives its `WHERE` without re-querying.
  - **`AuthzService.scope(user, resource, { action?, scope? })`**: resolves the constraint mirroring `can`'s order — super-admin (hook or global role) → wildcard permission grant for the action → registered filter → deny-all.
  - **Lucid adapter** (new subpath `@adonis-agora/authz/scope`): `accessibleBy(query, service, user, resource, opts?)` resolves + applies the scope to a Lucid query builder; `applyScopeConstraint(query, constraint)` is the primitive. `allow-all` adds nothing, `deny-all` adds `1 = 0`, conditions compile to parameterized, identifier-safe `where`/`whereIn`/`whereNull` clauses wrapped in their own group so they compose with existing clauses.
  - **Config**: `defineConfig({ scopes })` accepts a `ScopeRegistry` or a `(registry) => void` builder; the provider threads it into the container `AuthzService`.

## 0.3.0

### Minor Changes

- [`41cb5a9`](https://github.com/DavideCarvalho/adonis-authz/commit/41cb5a963451d06eb222e4a79acec0dca6474b8f) - Add four opt-in Agora integration features (all default-OFF, structural — no hard deps):

  - Tenant auto-scope: `resolveTenant: tenantFromContext` (or a custom resolver) defaults an unscoped check's tenant to the active Agora context's `tenantId`.
  - Global-role bridge (read-time, no seeding): `superAdminRoles` short-circuits allow; `globalRoleGrants` unions global-role permissions into checks. Global roles are read structurally from the Agora context store (`globalRoles`).
  - Event-driven provisioning: `defineAuthzProvisioning(config)` (new subpath `@adonis-agora/authz/provisioning`) subscribes to authkit diagnostics events via the optional `@adonis-agora/diagnostics` peer and runs config-mapped actions against the store (best-effort, never throws).
  - `POST /authz/can` endpoint: `registerCanEndpoint(router, opts)` (new subpath `@adonis-agora/authz/http`) returns `{ allowed }` for `{ permission, resource? }`.

- [`cdd293e`](https://github.com/DavideCarvalho/adonis-authz/commit/cdd293e506792c1e4c0632987a6b5675fed2942b) - fix: consistent super-admin across can/hasRole/hasAnyRole; collapse super-admin layers; drop resolveTenant:'context' magic string; tighten DiagnosticEvent/CanHttpContext types

  - **Bug fix:** `hasAnyRole` now honors the `superAdmin` hook and global super-admin roles, matching `can` and `hasRole`. Previously a global/hook super-admin got `true` from `hasRole('x')` but `false` from `hasAnyRole(['x'])`.
  - The two parallel super-admin mechanisms (the `superAdmin` hook and `superAdminRoles`/global roles) are collapsed into a single private guard used identically by `can`, `hasRole`, and `hasAnyRole`. Global permission grants (`globalRoleGrants`) are now folded into the single permission-union site in `can` only — role checks never consult permission grants.
  - **Breaking (pre-1.0):** `resolveTenant` no longer accepts the `'context'` magic string; pass a resolver instead. Use the exported `tenantFromContext` for the previous built-in behavior: `resolveTenant: tenantFromContext`.
  - Tightened contracts: dropped the open `[key: string]: unknown` index signatures from `DiagnosticEvent` and `CanHttpContext` so the documented typed fields narrow.

## 0.2.0

### Minor Changes

- [`00e3562`](https://github.com/DavideCarvalho/adonis-authz/commit/00e35620529d659607c750f0adc1a04b7075a420) - Add identityUserRef seam for pairing with an authentication provider (e.g. AuthKit)

- [`518aa72`](https://github.com/DavideCarvalho/adonis-authz/commit/518aa720ca2346edd84b4b539ff31e4661222c33) - Require AdonisJS v7 (bump @adonisjs/\* peers; Bouncer 4, Lucid 22)
