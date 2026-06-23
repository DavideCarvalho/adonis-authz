---
"@adonis-agora/authz": minor
---

Add four opt-in Agora integration features (all default-OFF, structural — no hard deps):

- Tenant auto-scope: `resolveTenant: tenantFromContext` (or a custom resolver) defaults an unscoped check's tenant to the active Agora context's `tenantId`.
- Global-role bridge (read-time, no seeding): `superAdminRoles` short-circuits allow; `globalRoleGrants` unions global-role permissions into checks. Global roles are read structurally from the Agora context store (`globalRoles`).
- Event-driven provisioning: `defineAuthzProvisioning(config)` (new subpath `@adonis-agora/authz/provisioning`) subscribes to authkit diagnostics events via the optional `@adonis-agora/diagnostics` peer and runs config-mapped actions against the store (best-effort, never throws).
- `POST /authz/can` endpoint: `registerCanEndpoint(router, opts)` (new subpath `@adonis-agora/authz/http`) returns `{ allowed }` for `{ permission, resource? }`.
