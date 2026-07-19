import app from '@adonisjs/core/services/app';
import { AuthzService } from '../src/authz_service.js';

/**
 * The async authorization-query surface of {@link AuthzService} this service singleton forwards.
 * Typed with `Pick` so the forwards below stay in lockstep with the class: if a method's signature
 * changes, the delegating object stops compiling instead of drifting. The sync members
 * (`store`, `scopes`, `createCache`) are intentionally omitted — they cannot be exposed without
 * resolving the container synchronously, and a config-time consumer (e.g. the agent tool authorizer)
 * only needs the async decision API. Resolve {@link AuthzService} directly for the rest.
 */
export type AuthzQueryService = Pick<
  AuthzService,
  'can' | 'scope' | 'hasRole' | 'hasAnyRole' | 'effectiveRoles' | 'effectivePermissions'
>;

/**
 * Resolve the container-bound {@link AuthzService} ONCE and reuse it. Resolution is deferred to the
 * first method call — NOT a top-level `await app.container.make(...)` / `await app.booted(...)` —
 * so importing this module from `config/*` is safe: config loads DURING boot, before the container
 * bindings and `booted()` callbacks exist, and a top-level await there would deadlock the boot.
 * By the time any forwarded method actually runs (request / agent time) the app is booted and the
 * `AuthzService` singleton is resolvable.
 */
let servicePromise: Promise<AuthzService> | undefined;
const resolve = (): Promise<AuthzService> => {
  servicePromise ??= app.container.make(AuthzService);
  return servicePromise;
};

/**
 * The `@adonis-agora/authz` service singleton — a lazy, container-backed {@link AuthzService}.
 * Import it wherever a resolved `AuthzService` is needed without hand-rolling
 * `await app.container.make(AuthzService)`, including at config-load time:
 *
 * ```ts
 * import authz from '@adonis-agora/authz/services/main'
 * import { authzToolAuthorizer } from '@adonis-agora/agent/authz'
 *
 * export default defineConfig({
 *   authorizer: authzToolAuthorizer({ authz }),
 * })
 * ```
 */
const service: AuthzQueryService = {
  can: (...args) => resolve().then((authz) => authz.can(...args)),
  scope: (...args) => resolve().then((authz) => authz.scope(...args)),
  hasRole: (...args) => resolve().then((authz) => authz.hasRole(...args)),
  hasAnyRole: (...args) => resolve().then((authz) => authz.hasAnyRole(...args)),
  effectiveRoles: (...args) => resolve().then((authz) => authz.effectiveRoles(...args)),
  effectivePermissions: (...args) => resolve().then((authz) => authz.effectivePermissions(...args)),
};

export default service;
