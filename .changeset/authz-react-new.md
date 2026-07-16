---
"@adonis-agora/authz-react": minor
---

New package: `@adonis-agora/authz-react`. React/Inertia bindings for `@adonis-agora/authz`:

- `buildAuthzShare(authz, user, scope?)` (server, `@adonis-agora/authz-react/server`) — builds the Inertia share from `AuthzService#effectiveRoles`/`#effectivePermissions` (store ∪ roleGrants ∪ resolveRoles ∪ context), the same union `can()` uses, so client-side gating matches the server decision.
- `AuthzProvider`/`useAuthz` (client) — read the share from an optional `<AuthzProvider>` context, falling back to `usePage().props.authz`.
- `useCan(permission)` and `<Can permission="..."> | <Can role="...">` — wildcard-aware permission gating (a client-safe port of the core's matcher) and exact role gating, fail-closed with no share.

Ships as two subpaths (`.` for the client bundle, `./server` for the Inertia middleware) so the server-only `AuthzService` type import never reaches the client bundle.
