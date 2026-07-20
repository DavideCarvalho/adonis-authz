---
'@adonis-agora/authz': patch
---

Fix: the reverse-lookup seams `resolveRoleMembers` and `resolveGlobalRoleMembers` (added in 0.10.0) are now reachable through `defineConfig`. They were declared on `AuthzServiceOptions` but missing from the `AuthzConfig` type and not forwarded by `AuthzProvider`, so `authz.usersWithRole` ignored them when configured via `config/authz.ts`. Added to `AuthzConfig` and wired through the provider (mirroring `resolveRoles`), with a provider-level plumbing test.
