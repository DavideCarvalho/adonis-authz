import { PermissionCache } from './permission_cache.js';
import { permissionSatisfied } from './permission_matcher.js';
import type { PermissionStore } from './store.js';
import {
  type ResolveUserRef,
  type TenantScope,
  type UserRef,
  defaultResolveUserRef,
  normalizeUserRef,
} from './user_ref.js';

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

  constructor(options: AuthzServiceOptions) {
    this.store = options.store;
    this.superAdmin = options.superAdmin;
    this.resolveUserRef = options.resolveUserRef ?? defaultResolveUserRef;
    this.tenant = options.tenant;
  }

  /** Map a host user object to a canonical {@link UserRef} (or undefined). */
  refOf(user: unknown): UserRef | undefined {
    const input = this.resolveUserRef(user);
    if (input == null) return undefined;
    return normalizeUserRef(input);
  }

  /** The active tenant scope, read from the configured resolver. */
  currentScope(scope?: TenantScope): TenantScope | undefined {
    if (scope) return scope;
    if (!this.tenant) return undefined;
    return normalizeTenantResolver(this.tenant());
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

    if (this.superAdmin) {
      const verdict = await this.superAdmin(ref, permission);
      if (verdict === true) return true;
      if (verdict === false) return false;
    }

    const scope = this.currentScope(options.scope);
    if (options.cache) {
      return options.cache.satisfies(ref, permission, scope);
    }
    const granted = await this.store.getPermissionsForUser(ref, scope);
    return permissionSatisfied(granted, permission);
  }

  /** Does the user have the named role (exact match, tenant-aware)? */
  async hasRole(
    user: unknown,
    role: string,
    options: { scope?: TenantScope } = {},
  ): Promise<boolean> {
    const ref = this.refOf(user);
    if (!ref) return false;

    if (this.superAdmin) {
      const verdict = await this.superAdmin(ref, `role:${role}`);
      if (verdict === true) return true;
      if (verdict === false) return false;
    }

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
    const scope = this.currentScope(options.scope);
    const owned = new Set(await this.store.getRolesForUser(ref, scope));
    return roles.some((r) => owned.has(r));
  }
}
