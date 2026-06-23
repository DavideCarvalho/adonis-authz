---
"@adonis-agora/authz": minor
---

fix: consistent super-admin across can/hasRole/hasAnyRole; collapse super-admin layers; drop resolveTenant:'context' magic string; tighten DiagnosticEvent/CanHttpContext types

- **Bug fix:** `hasAnyRole` now honors the `superAdmin` hook and global super-admin roles, matching `can` and `hasRole`. Previously a global/hook super-admin got `true` from `hasRole('x')` but `false` from `hasAnyRole(['x'])`.
- The two parallel super-admin mechanisms (the `superAdmin` hook and `superAdminRoles`/global roles) are collapsed into a single private guard used identically by `can`, `hasRole`, and `hasAnyRole`. Global permission grants (`globalRoleGrants`) are now folded into the single permission-union site in `can` only — role checks never consult permission grants.
- **Breaking (pre-1.0):** `resolveTenant` no longer accepts the `'context'` magic string; pass a resolver instead. Use the exported `tenantFromContext` for the previous built-in behavior: `resolveTenant: tenantFromContext`.
- Tightened contracts: dropped the open `[key: string]: unknown` index signatures from `DiagnosticEvent` and `CanHttpContext` so the documented typed fields narrow.
