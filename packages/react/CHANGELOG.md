# @adonis-agora/authz-react

## 3.0.1

### Patch Changes

- Updated dependencies [[`ad2dff0`](https://github.com/DavideCarvalho/adonis-authz/commit/ad2dff0bb7a12943e47ae05d72604ec754523589)]:
  - @adonis-agora/authz@0.10.0

## 3.0.0

### Patch Changes

- Updated dependencies [[`afe5d3b`](https://github.com/DavideCarvalho/adonis-authz/commit/afe5d3b2fe0fbfed65f2645d120be16c307c6afe)]:
  - @adonis-agora/authz@0.9.0

## 2.0.0

### Patch Changes

- Updated dependencies [[`e2cb451`](https://github.com/DavideCarvalho/adonis-authz/commit/e2cb45176db474b40b51bedf85277074f95b77a0)]:
  - @adonis-agora/authz@0.8.0

## 1.0.0

### Patch Changes

- Updated dependencies [[`c9d2d0f`](https://github.com/DavideCarvalho/adonis-authz/commit/c9d2d0f4025a3b9063ad9fadaaed071a6f9cebdc)]:
  - @adonis-agora/authz@0.7.0

## 0.1.0

### Minor Changes

- [#9](https://github.com/DavideCarvalho/adonis-authz/pull/9) [`50ec77f`](https://github.com/DavideCarvalho/adonis-authz/commit/50ec77f0b81a7deeec089e286b877bcfb20148d2) Thanks [@DavideCarvalho](https://github.com/DavideCarvalho)! - New package: `@adonis-agora/authz-react`. React/Inertia bindings for `@adonis-agora/authz`:

  - `buildAuthzShare(authz, user, scope?)` (server, `@adonis-agora/authz-react/server`) — builds the Inertia share from `AuthzService#effectiveRoles`/`#effectivePermissions` (store ∪ roleGrants ∪ resolveRoles ∪ context), the same union `can()` uses, so client-side gating matches the server decision.
  - `AuthzProvider`/`useAuthz` (client) — read the share from an optional `<AuthzProvider>` context, falling back to `usePage().props.authz`.
  - `useCan(permission)` and `<Can permission="..."> | <Can role="...">` — wildcard-aware permission gating (a client-safe port of the core's matcher) and exact role gating, fail-closed with no share.

  Ships as two subpaths (`.` for the client bundle, `./server` for the Inertia middleware) so the server-only `AuthzService` type import never reaches the client bundle.
