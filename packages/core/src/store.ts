import type { TenantScope, UserRef } from './user_ref.js';

/**
 * The DB-backed RBAC store contract — ported from nestjs-authz's
 * `TypeOrmAuthzStore` public API. Implementations are the "thin store" Bouncer
 * abilities consult at check time.
 *
 * Semantics every implementation MUST preserve:
 * - All write methods are idempotent and race-tolerant.
 * - `assignRole` / `removeRole` / `getRolesForUser` / `getPermissionsForUser`
 *   are tenant-aware. Direct user-permission grants are tenant-independent.
 * - Tenant visibility: a global request (`''`) sees only global rows; a
 *   tenant request sees global rows AND that tenant's rows. A tenant-scoped
 *   assignment never leaks into an unscoped check.
 * - `userHasPermission` matches permission NAMES exactly. Wildcard expansion is
 *   the caller's job (it reads `getPermissionsForUser` and runs the matcher).
 */
export interface PermissionStore {
  /** Create/upgrade the RBAC tables (no-op for the memory store). */
  ensureSchema(): Promise<void>;

  /** Idempotently create a role by name; returns its id. */
  createRole(name: string): Promise<string>;
  /** Idempotently create a permission by name; returns its id. */
  createPermission(name: string): Promise<string>;

  /** Grant a permission to a role (creating either by name as needed). */
  givePermissionToRole(roleName: string, permissionName: string): Promise<void>;
  /** Revoke a permission from a role; no-op when either is absent. */
  revokePermissionFromRole(roleName: string, permissionName: string): Promise<void>;

  /** Assign a role to a user (optionally tenant-scoped). */
  assignRole(user: UserRef, roleName: string, scope?: TenantScope): Promise<void>;
  /** Remove a role assignment matching the exact tenant scope. */
  removeRole(user: UserRef, roleName: string, scope?: TenantScope): Promise<void>;

  /** Grant a permission directly to a user (tenant-independent). */
  giveUserPermission(user: UserRef, permissionName: string): Promise<void>;
  /** Revoke a direct user grant (role-derived permissions survive). */
  revokeUserPermission(user: UserRef, permissionName: string): Promise<void>;

  /** Role names for a user, tenant-filtered. */
  getRolesForUser(user: UserRef, scope?: TenantScope): Promise<string[]>;
  /** Effective permission names for a user (role-derived ∪ direct). */
  getPermissionsForUser(user: UserRef, scope?: TenantScope): Promise<string[]>;

  /**
   * Exact-name check: does the user hold `permission` via a role (tenant-aware)
   * or a direct grant? Wildcards are NOT expanded here.
   */
  userHasPermission(user: UserRef, permission: string, scope?: TenantScope): Promise<boolean>;

  /** List every role name known to the store (for ace `authz:list`). */
  listRoles(): Promise<string[]>;
  /** List every permission name known to the store (for ace `authz:list`). */
  listPermissions(): Promise<string[]>;
  /** List the permission names attached to a role. */
  getRolePermissions(roleName: string): Promise<string[]>;
}
