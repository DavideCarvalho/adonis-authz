---
'@adonis-agora/authz': minor
---

Add the reverse effective-role lookup `authz.usersWithRole(role, scope?)` — the symmetric counterpart of `effectiveRoles`. It unions three sources in parallel: the authz store (new `PermissionStore.getUsersForRole(role, scope?)`, implemented for the Lucid and Memory stores with the same tenant-visibility rule as `getRolesForUser`), the domain reverse seam `resolveRoleMembers`, and the global/IdP reverse seam `resolveGlobalRoleMembers`. Bare-string ids are normalized to the default user type, `UserRefInput` objects via the existing normalizer, and results are deduped by `(type, id)`. Also surfaced on the `@adonis-agora/authz/services/main` singleton.
