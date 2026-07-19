---
'@adonis-agora/authz': minor
---

Add a service singleton export `@adonis-agora/authz/services/main` — a lazy, container-backed `AuthzService`. It resolves the container-bound service once, on first method call (not a top-level `await`), so it is safe to import from `config/*` without deadlocking boot. Use it wherever a resolved `AuthzService` is needed without hand-rolling `await app.container.make(AuthzService)`, including wiring the agent tool authorizer:

```ts
import authz from '@adonis-agora/authz/services/main'
import { authzToolAuthorizer } from '@adonis-agora/agent/authz'

export default defineConfig({
  authorizer: authzToolAuthorizer({ authz }),
})
```

It forwards the async authorization-query surface (`can`, `scope`, `hasRole`, `hasAnyRole`, `effectiveRoles`, `effectivePermissions`).
