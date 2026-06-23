import type { ApplicationService } from '@adonisjs/core/types';
import type { PermissionStore } from '../store.js';
import type { AuthzTableNames, LucidDatabase } from './lucid.js';
import { MemoryPermissionStore } from './memory.js';

export interface StoreContext {
  app: ApplicationService;
}

/**
 * A configured store: a thunk the provider calls at boot. Each provider lazily
 * imports its optional peer dependency INSIDE the thunk, so the driver (and its
 * peer) is only loaded when actually selected.
 */
export type StoreProvider = (ctx: StoreContext) => Promise<PermissionStore>;

export interface MemoryStoreConfig {
  // Reserved for future options; the memory store currently takes none.
}

export interface LucidStoreConfig {
  /** Lucid connection name; defaults to the app's default connection. */
  connection?: string;
  /** Table-name overrides (defaults match the published migration). */
  tables?: AuthzTableNames;
  /** Auto-create tables on first use (default true). Set false when migrating. */
  autoCreateSchema?: boolean;
}

/**
 * The `stores` namespace lives in core (drivers-in-core idiom). Each factory
 * returns a lazy async thunk; calling it in config is free. The Lucid driver
 * `await import()`s `@adonisjs/lucid/services/db` and its own adapter module only
 * when the provider builds it — keeping the peer optional.
 */
export const stores = {
  memory(_config: MemoryStoreConfig = {}): StoreProvider {
    return async () => new MemoryPermissionStore();
  },

  lucid(config: LucidStoreConfig = {}): StoreProvider {
    return async () => {
      const db = (await import('@adonisjs/lucid/services/db')).default;
      const { LucidPermissionStore } = await import('./lucid.js');
      const { connection, ...rest } = config;
      const client = connection
        ? (db.connection(connection) as unknown as LucidDatabase)
        : (db as unknown as LucidDatabase);
      return new LucidPermissionStore(client, rest);
    };
  },
};
