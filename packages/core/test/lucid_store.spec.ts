import type { Database } from '@adonisjs/lucid/database';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LucidPermissionStore } from '../src/stores/lucid.js';
import { asLucidDatabase, makeMemoryDatabase } from './lucid_helpers.js';

describe('LucidPermissionStore (sqlite)', () => {
  let db: Database;

  beforeEach(() => {
    db = makeMemoryDatabase();
  });
  afterEach(async () => {
    await db.manager.closeAll();
  });

  it('auto-creates the schema and is idempotent across instances', async () => {
    const a = new LucidPermissionStore(asLucidDatabase(db));
    await a.givePermissionToRole('editor', 'posts.edit');
    await a.assignRole({ type: 'user', id: '7' }, 'editor');

    // A second instance over the same db sees the persisted rows.
    const b = new LucidPermissionStore(asLucidDatabase(db));
    expect(await b.userHasPermission({ type: 'user', id: '7' }, 'posts.edit')).toBe(true);
  });

  it('persists distinct tenant assignments independently', async () => {
    const store = new LucidPermissionStore(asLucidDatabase(db));
    const user = { type: 'user', id: '9' };
    await store.givePermissionToRole('billing', 'billing.view');
    await store.assignRole(user, 'billing', { tenantId: 'acme' });

    expect(await store.userHasPermission(user, 'billing.view')).toBe(false);
    expect(await store.userHasPermission(user, 'billing.view', { tenantId: 'acme' })).toBe(true);
    expect(await store.userHasPermission(user, 'billing.view', { tenantId: 'globex' })).toBe(false);
  });

  it('honors autoCreateSchema:false (manual ensureSchema)', async () => {
    const store = new LucidPermissionStore(asLucidDatabase(db), { autoCreateSchema: false });
    await store.ensureSchema();
    await store.createRole('manual');
    expect(await store.listRoles()).toContain('manual');
  });
});
