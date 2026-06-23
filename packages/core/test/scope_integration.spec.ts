import type { Database } from '@adonisjs/lucid/database';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthzService } from '../src/authz_service.js';
import { type ScopeableQuery, accessibleBy } from '../src/lucid_scope.js';
import { ScopeRegistry, and, eq } from '../src/scope.js';
import { LucidPermissionStore } from '../src/stores/lucid.js';
import { asLucidDatabase, makeMemoryDatabase } from './lucid_helpers.js';

/** A `posts` table: id, author_id, tenant_id, title. Seeded with a known fixture set. */
async function seedPosts(db: Database): Promise<void> {
  await db.rawQuery(
    `CREATE TABLE posts (
       id INTEGER PRIMARY KEY,
       author_id VARCHAR(191) NOT NULL,
       tenant_id VARCHAR(191) NOT NULL DEFAULT '',
       title VARCHAR(191) NOT NULL
     )`,
  );
  const rows: [number, string, string, string][] = [
    [1, '7', 'acme', 'alice-acme'],
    [2, '7', 'globex', 'alice-globex'],
    [3, '99', 'acme', 'bob-acme'],
    [4, '99', 'globex', 'bob-globex'],
  ];
  for (const [id, author, tenant, title] of rows) {
    await db.rawQuery('INSERT INTO posts (id, author_id, tenant_id, title) VALUES (?, ?, ?, ?)', [
      id,
      author,
      tenant,
      title,
    ]);
  }
}

/** A Lucid query against the seeded `posts` table, returning matched ids. */
function postsQuery(db: Database): ScopeableQuery & PromiseLike<{ id: number }[]> {
  return db.from('posts').select('id').orderBy('id') as unknown as ScopeableQuery &
    PromiseLike<{ id: number }[]>;
}

async function idsOf(q: PromiseLike<{ id: number }[]>): Promise<number[]> {
  const rows = await q;
  return rows.map((r) => r.id);
}

describe('accessibleBy — Lucid query-scope (integration)', () => {
  let db: Database;
  let store: LucidPermissionStore;

  beforeEach(async () => {
    db = makeMemoryDatabase();
    await seedPosts(db);
    store = new LucidPermissionStore(asLucidDatabase(db));
  });
  afterEach(async () => {
    await db.manager.closeAll();
  });

  /** A registry where `posts` scopes to rows the user authored (ownership). */
  function ownershipScopes(): ScopeRegistry {
    return new ScopeRegistry().register('posts', (ctx) => eq('author_id', ctx.user.id));
  }

  it('non-privileged user: ownership WHERE is injected', async () => {
    const service = new AuthzService({ store, scopes: ownershipScopes() });
    const user = { id: '7' };

    const q = await accessibleBy(postsQuery(db), service, user, 'posts');
    // Only Alice's (author_id = 7) posts.
    expect(await idsOf(q)).toEqual([1, 2]);
  });

  it('global super-admin: allow-all (no restriction)', async () => {
    const service = new AuthzService({
      store,
      scopes: ownershipScopes(),
      superAdmin: (_u, _a) => true,
    });
    const q = await accessibleBy(postsQuery(db), service, { id: '7' }, 'posts');
    // Every row, despite the ownership filter being registered.
    expect(await idsOf(q)).toEqual([1, 2, 3, 4]);
  });

  it('permission grant for the action: allow-all', async () => {
    const service = new AuthzService({ store, scopes: ownershipScopes() });
    await store.givePermissionToRole('reader', 'posts.*');
    await store.assignRole({ type: 'user', id: '7' }, 'reader');

    const q = await accessibleBy(postsQuery(db), service, { id: '7' }, 'posts', {
      action: 'posts.viewAny',
    });
    expect(await idsOf(q)).toEqual([1, 2, 3, 4]);
  });

  it('unknown resource: deny-all (fail-closed, no rows)', async () => {
    const service = new AuthzService({ store, scopes: ownershipScopes() });
    // `comments` is not registered → deny-all.
    const q = await accessibleBy(postsQuery(db), service, { id: '7' }, 'comments');
    expect(await idsOf(q)).toEqual([]);
  });

  it('anonymous user: deny-all (no rows)', async () => {
    const service = new AuthzService({ store, scopes: ownershipScopes() });
    const q = await accessibleBy(postsQuery(db), service, null, 'posts');
    expect(await idsOf(q)).toEqual([]);
  });

  it('tenant scoping composes with ownership', async () => {
    // Scope = own posts AND posts in the active tenant. The filter derives the tenant
    // from the same ctx the service resolved.
    const scopes = new ScopeRegistry().register('posts', (ctx) =>
      and(eq('author_id', ctx.user.id), eq('tenant_id', ctx.tenant?.tenantId ?? '')),
    );
    const service = new AuthzService({ store, scopes, tenant: () => 'acme' });

    const q = await accessibleBy(postsQuery(db), service, { id: '7' }, 'posts');
    // Alice's posts in tenant acme only → id 1 (not 2, which is globex).
    expect(await idsOf(q)).toEqual([1]);
  });

  it('composes with pre-existing where clauses on the query', async () => {
    const service = new AuthzService({ store, scopes: ownershipScopes() });
    const base = postsQuery(db).where('tenant_id', '=', 'globex');
    const q = await accessibleBy(base, service, { id: '7' }, 'posts');
    // author_id = 7 AND tenant_id = globex → id 2.
    expect(await idsOf(q as never)).toEqual([2]);
  });
});
