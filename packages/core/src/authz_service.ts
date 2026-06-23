import { globalRolesFromContext } from './agora/context.js';
import { PermissionCache } from './permission_cache.js';
import { permissionSatisfied } from './permission_matcher.js';
import {
  type ResourceKey,
  type ScopeConstraint,
  ScopeRegistry,
  normalizeScope,
  scopeAll,
  scopeNone,
} from './scope.js';
import type { PermissionStore } from './store.js';
import {
  type ResolveUserRef,
  type TenantScope,
  type UserRef,
  defaultResolveUserRef,
  normalizeUserRef,
} from './user_ref.js';

export { tenantFromContext } from './agora/context.js';

/**
 * Super-admin hook (ported from nestjs-authz). Receives the mapped {@link UserRef}
 * and the ability/permission being checked.
 *
 * - `true`  → allow (short-circuit).
 * - `false` → deny (short-circuit). Super-admin is the only hook whose `false`
 *   actively denies.
 * - nullish → fall through to the normal RBAC resolution.
 */
export type SuperAdminHook = (
  user: UserRef,
  ability: string,
) => boolean | undefined | Promise<boolean | undefined>;

/** Reads the active tenant for the current request (e.g. from HTTP context). */
export type TenantResolver = () => string | undefined | TenantScope | undefined;

export interface AuthzServiceOptions {
  store: PermissionStore;
  superAdmin?: SuperAdminHook;
  resolveUserRef?: ResolveUserRef;
  tenant?: TenantResolver;
  /**
   * Opt-in tenant auto-scope (feature B). When a check gets no explicit tenant
   * and no `tenant` resolver yields one, default the tenant to a resolver's
   * value. Pass {@link tenantFromContext} to default to the active Agora
   * context's `tenantId`, or any custom resolver. Default (unset) leaves
   * behavior unchanged — no context → `''` global scope.
   */
  resolveTenant?: () => string | undefined;
  /**
   * Opt-in global-role bridge (feature C). Global role names that grant
   * super-admin (short-circuit allow). Read structurally from the active Agora
   * context store (`globalRoles`, written by authkit). No DB seeding.
   */
  superAdminRoles?: string[];
  /**
   * Opt-in global-role bridge (feature C). Map of global role name →
   * permissions/wildcards that role grants. Unioned into permission checks at
   * check time for the user's active global roles. No DB seeding.
   */
  globalRoleGrants?: Record<string, string[]>;
  /**
   * Query-scope registry (feature E). Pre-built {@link ScopeRegistry} mapping each
   * resource to a scope filter for {@link AuthzService.scope} / the Lucid
   * `accessibleBy` helper. A shared default registry is created when unset, so a
   * host may also register via {@link AuthzService.scopes}.
   */
  scopes?: ScopeRegistry;
}

function normalizeTenantResolver(value: string | TenantScope | undefined): TenantScope | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string') return { tenantId: value };
  return value;
}

/**
 * The authorization engine that Bouncer abilities consult. It maps a host user
 * to a {@link UserRef}, applies the super-admin hook, then resolves a permission
 * via the {@link PermissionStore} using WILDCARD matching (so `posts.*` grants
 * `posts.edit`). Roles are checked exactly.
 *
 * Resolution order for {@link can} mirrors the port:
 *   1. super-admin hook (may allow or deny);
 *   2. wildcard permission grant from the store (grant-only);
 *   3. otherwise deny.
 */
export class AuthzService {
  readonly store: PermissionStore;
  private readonly superAdmin: SuperAdminHook | undefined;
  private readonly resolveUserRef: ResolveUserRef;
  private readonly tenant: TenantResolver | undefined;
  private readonly resolveTenant: (() => string | undefined) | undefined;
  private readonly superAdminRoles: ReadonlySet<string>;
  private readonly globalRoleGrants: Record<string, string[]> | undefined;

  /** The query-scope registry (resource → scope filter). See {@link scope}. */
  readonly scopes: ScopeRegistry;

  constructor(options: AuthzServiceOptions) {
    this.store = options.store;
    this.superAdmin = options.superAdmin;
    this.resolveUserRef = options.resolveUserRef ?? defaultResolveUserRef;
    this.tenant = options.tenant;
    this.resolveTenant = options.resolveTenant;
    this.superAdminRoles = new Set(options.superAdminRoles ?? []);
    this.globalRoleGrants = options.globalRoleGrants;
    this.scopes = options.scopes ?? new ScopeRegistry();
  }

  /** Map a host user object to a canonical {@link UserRef} (or undefined). */
  refOf(user: unknown): UserRef | undefined {
    const input = this.resolveUserRef(user);
    if (input == null) return undefined;
    return normalizeUserRef(input);
  }

  /**
   * The active tenant scope. Precedence: explicit `scope` arg → configured
   * `tenant` resolver → opt-in `resolveTenant` (feature B, e.g. the Agora
   * context). When nothing yields a tenant, returns `undefined` (global `''`).
   */
  currentScope(scope?: TenantScope): TenantScope | undefined {
    if (scope) return scope;
    if (this.tenant) {
      const fromResolver = normalizeTenantResolver(this.tenant());
      if (fromResolver) return fromResolver;
    }
    if (this.resolveTenant) {
      const fromContext = this.resolveTenant();
      if (fromContext) return { tenantId: fromContext };
    }
    return undefined;
  }

  /**
   * The single super-admin guard, consulted identically by {@link can},
   * {@link hasRole}, and {@link hasAnyRole}. Returns:
   *
   * - `true`  → super-admin granted (caller should short-circuit allow);
   * - `false` → super-admin actively denied (caller should short-circuit deny);
   * - `undefined` → no verdict, fall through to normal resolution.
   *
   * It applies the {@link SuperAdminHook} first (the only hook whose `false`
   * denies), then the global super-admin roles (feature C).
   */
  private async superAdminVerdict(ref: UserRef, ability: string): Promise<boolean | undefined> {
    if (this.superAdmin) {
      const verdict = await this.superAdmin(ref, ability);
      if (verdict === true) return true;
      if (verdict === false) return false;
    }
    if (this.isGlobalSuperAdmin()) return true;
    return undefined;
  }

  /**
   * Global-role bridge (feature C): is any of the user's active global roles
   * (read structurally from the Agora context store) a configured super-admin
   * role?
   */
  private isGlobalSuperAdmin(): boolean {
    if (this.superAdminRoles.size === 0) return false;
    for (const role of globalRolesFromContext()) {
      if (this.superAdminRoles.has(role)) return true;
    }
    return false;
  }

  /**
   * Global-role bridge (feature C): the permissions/wildcards granted by the
   * user's active global roles, unioned into the permission check in {@link can}.
   * Roles ≠ permissions, so role checks never consult these.
   */
  private globalPermissionGrants(): string[] {
    if (!this.globalRoleGrants) return [];
    const roles = globalRolesFromContext();
    if (roles.length === 0) return [];
    const grants: string[] = [];
    for (const role of roles) {
      const perms = this.globalRoleGrants[role];
      if (perms) grants.push(...perms);
    }
    return grants;
  }

  /** A fresh per-request permission cache bound to the active store. */
  createCache(): PermissionCache {
    return new PermissionCache(this.store);
  }

  /**
   * Does the user hold `permission` (with wildcard matching)? Honors the
   * super-admin hook. Pass a `cache` to coalesce reads across a request.
   */
  async can(
    user: unknown,
    permission: string,
    options: { scope?: TenantScope; cache?: PermissionCache } = {},
  ): Promise<boolean> {
    const ref = this.refOf(user);
    if (!ref) return false;

    const superAdmin = await this.superAdminVerdict(ref, permission);
    if (superAdmin !== undefined) return superAdmin;

    const scope = this.currentScope(options.scope);
    // Single permission-union site: store grants ∪ global-role grants (feature C).
    const granted = options.cache
      ? await options.cache.getPermissions(ref, scope)
      : await this.store.getPermissionsForUser(ref, scope);
    return permissionSatisfied([...granted, ...this.globalPermissionGrants()], permission);
  }

  /**
   * Resolve the QUERY-SCOPE constraint for `user` against `resource` — the
   * `accessibleBy` / Pundit `policy_scope` concept. Returns an ORM-neutral
   * {@link ScopeConstraint} the Lucid `accessibleBy` helper turns into a
   * parameterized `WHERE`.
   *
   * Mirrors {@link can}'s resolution order so scoping stays consistent with
   * single-resource decisions:
   *   1. super-admin (hook or global role) grants → `allow-all` (no filter);
   *   2. a wildcard permission grant for `action` → `allow-all`;
   *   3. the resource's registered scope filter → its constraint (fed the user's
   *      effective roles/permissions/tenant so it derives from the SAME authz data);
   *   4. otherwise (anonymous, or no scope registered) → `deny-all` (fail-closed).
   *
   * `action` (default `'viewAny'`) names the permission-grant check and is passed to
   * the scope filter as the ability being scoped.
   */
  async scope(
    user: unknown,
    resource: ResourceKey,
    options: { action?: string; scope?: TenantScope; cache?: PermissionCache } = {},
  ): Promise<ScopeConstraint> {
    const action = options.action ?? 'viewAny';
    const ref = this.refOf(user);
    // 4 (anonymous): no user → deny-all.
    if (!ref) return scopeNone;

    // 1. Super-admin (hook or global role) → allow-all. A `false` here actively
    //    denies, mirroring `can`.
    const superAdmin = await this.superAdminVerdict(ref, action);
    if (superAdmin === true) return scopeAll;
    if (superAdmin === false) return scopeNone;

    const tenant = this.currentScope(options.scope);
    const granted = options.cache
      ? await options.cache.getPermissions(ref, tenant)
      : await this.store.getPermissionsForUser(ref, tenant);
    const permissions = [...granted, ...this.globalPermissionGrants()];

    // 2. A wildcard permission grant for the scope action → allow-all.
    if (permissionSatisfied(permissions, action)) return scopeAll;

    // 3. The resource's registered scope filter.
    const filter = this.scopes.resolve(resource);
    if (!filter) return scopeNone; // fail-closed: unknown resource sees no rows.

    const roles = await this.store.getRolesForUser(ref, tenant);
    return normalizeScope(await filter({ user: ref, action, permissions, roles, tenant }));
  }

  /** Does the user have the named role (exact match, tenant-aware)? */
  async hasRole(
    user: unknown,
    role: string,
    options: { scope?: TenantScope } = {},
  ): Promise<boolean> {
    const ref = this.refOf(user);
    if (!ref) return false;

    const superAdmin = await this.superAdminVerdict(ref, `role:${role}`);
    if (superAdmin !== undefined) return superAdmin;

    const scope = this.currentScope(options.scope);
    const roles = await this.store.getRolesForUser(ref, scope);
    return roles.includes(role);
  }

  /** Does the user have ANY of the named roles? */
  async hasAnyRole(
    user: unknown,
    roles: string[],
    options: { scope?: TenantScope } = {},
  ): Promise<boolean> {
    const ref = this.refOf(user);
    if (!ref) return false;

    const superAdmin = await this.superAdminVerdict(ref, `role:${roles.join(',')}`);
    if (superAdmin !== undefined) return superAdmin;

    const scope = this.currentScope(options.scope);
    const owned = new Set(await this.store.getRolesForUser(ref, scope));
    return roles.some((r) => owned.has(r));
  }
}
