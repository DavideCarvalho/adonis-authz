---
"@adonis-agora/authz": minor
---

Add the `resolveRoles` seam: `AuthzConfig`/`AuthzServiceOptions` gain `resolveRoles?: (user, scope?) => string[] | Promise<string[]>` for the app's own role source (e.g. a `user_roles` table), unioned into `can()`, `hasRole()` and `scope()` alongside the context (token) roles and the store's roles. New public `effectiveRoles()`/`effectivePermissions()` expose that same union so `@adonis-agora/authz-react`'s `buildAuthzShare` can match server decisions.

**Breaking (0.x minor):** `globalRoleGrants` is renamed to `roleGrants` (no alias) on both `AuthzConfig` and `AuthzServiceOptions`, since it now applies to all effective roles (context + resolver), not just global/context ones. `hasRole()` now also recognizes context and `resolveRoles` roles, not just store-assigned ones (`hasAnyRole()` is unchanged — store-only).
