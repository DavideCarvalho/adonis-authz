# @adonis-agora/authz

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
