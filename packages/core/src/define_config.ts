import type { SuperAdminHook, TenantResolver } from './authz_service.js';
import { type StoreProvider, stores } from './stores/factory.js';
import type { ResolveUserRef } from './user_ref.js';

export interface AuthzConfig {
  /** Key of the active store in {@link AuthzConfig.stores}. */
  default?: string;
  /** Named stores, built with the `stores` factory (drivers-in-core). */
  stores?: Record<string, StoreProvider>;
  /** Optional super-admin hook: `true` allows, `false` denies, nullish falls through. */
  superAdmin?: SuperAdminHook;
  /** Map a host user object to a polymorphic user reference. */
  resolveUserRef?: ResolveUserRef;
  /** Resolve the active tenant for the current request (multi-tenancy). */
  tenant?: TenantResolver;
  /**
   * Declared roles → permissions catalog, seeded by `node ace authz:sync`.
   * Permissions listed are created and attached to each role (idempotent).
   */
  catalog?: AuthzCatalog;
}

/** A declarative roles → permissions map for `authz:sync`. */
export interface AuthzCatalog {
  /** Standalone permissions to create (in addition to those under roles). */
  permissions?: string[];
  /** role name → permission names granted to that role. */
  roles?: Record<string, string[]>;
}

/** Identity helper giving `config/authz.ts` full type-checking. */
export function defineConfig(config: AuthzConfig): AuthzConfig {
  return config;
}

export { stores };
export type {
  LucidStoreConfig,
  MemoryStoreConfig,
  StoreContext,
  StoreProvider,
} from './stores/factory.js';
export type { AuthzTableNames, LucidDatabase, LucidQueryClient } from './stores/lucid.js';
