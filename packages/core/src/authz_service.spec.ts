import { describe, expect, it } from 'vitest';
import { AuthzService } from './authz_service.js';
import { MemoryPermissionStore } from './stores/memory.js';

class User {
  constructor(
    public id: string,
    public type = 'user',
  ) {}
}

function makeService(opts: Partial<ConstructorParameters<typeof AuthzService>[0]> = {}) {
  const store = new MemoryPermissionStore();
  const service = new AuthzService({ store, ...opts });
  return { store, service };
}

describe('AuthzService', () => {
  it('grants via wildcard permission matching', async () => {
    const { store, service } = makeService();
    await store.givePermissionToRole('editor', 'posts.*');
    await store.assignRole({ type: 'user', id: '1' }, 'editor');

    const user = new User('1');
    expect(await service.can(user, 'posts.edit')).toBe(true);
    expect(await service.can(user, 'posts.delete')).toBe(true);
    expect(await service.can(user, 'comments.edit')).toBe(false);
  });

  it('denies an unmappable / anonymous user', async () => {
    const { service } = makeService();
    expect(await service.can(null, 'posts.edit')).toBe(false);
    expect(await service.can({}, 'posts.edit')).toBe(false);
  });

  it('super-admin true short-circuits to allow', async () => {
    const { service } = makeService({ superAdmin: (u) => u.id === '1' });
    expect(await service.can(new User('1'), 'anything.at.all')).toBe(true);
  });

  it('super-admin hook applies consistently to can, hasRole, AND hasAnyRole', async () => {
    const { service } = makeService({ superAdmin: (u) => u.id === '1' });
    const user = new User('1');
    expect(await service.can(user, 'anything.at.all')).toBe(true);
    expect(await service.hasRole(user, 'whatever')).toBe(true);
    expect(await service.hasAnyRole(user, ['whatever', 'else'])).toBe(true);
  });

  it('super-admin false short-circuits to deny', async () => {
    const { store, service } = makeService({ superAdmin: () => false });
    await store.givePermissionToRole('editor', 'posts.edit');
    await store.assignRole({ type: 'user', id: '1' }, 'editor');
    // Even though the grant exists, the super-admin hook denies.
    expect(await service.can(new User('1'), 'posts.edit')).toBe(false);
  });

  it('checks roles exactly', async () => {
    const { store, service } = makeService();
    await store.assignRole({ type: 'user', id: '1' }, 'admin');
    const user = new User('1');
    expect(await service.hasRole(user, 'admin')).toBe(true);
    expect(await service.hasRole(user, 'editor')).toBe(false);
    expect(await service.hasAnyRole(user, ['editor', 'admin'])).toBe(true);
  });

  it('reads the active tenant from the resolver', async () => {
    let tenant: string | undefined;
    const { store, service } = makeService({ tenant: () => tenant });
    await store.givePermissionToRole('viewer', 'reports.view');
    await store.assignRole({ type: 'user', id: '1' }, 'viewer', { tenantId: 'acme' });

    const user = new User('1');
    tenant = undefined;
    expect(await service.can(user, 'reports.view')).toBe(false);
    tenant = 'acme';
    expect(await service.can(user, 'reports.view')).toBe(true);
  });

  it('honors a custom resolveUserRef', async () => {
    const { store, service } = makeService({
      resolveUserRef: (u) => ({ type: 'account', id: (u as { uid: string }).uid }),
    });
    await store.givePermissionToRole('owner', 'org.manage');
    await store.assignRole({ type: 'account', id: 'abc' }, 'owner');
    expect(await service.can({ uid: 'abc' }, 'org.manage')).toBe(true);
  });
});

describe('AuthzService.usersWithRole', () => {
  it('unions the store, domain seam, and global seam', async () => {
    const { store, service } = makeService({
      resolveRoleMembers: () => ['2'],
      resolveGlobalRoleMembers: () => ['3'],
    });
    await store.assignRole({ type: 'user', id: '1' }, 'editor');

    const users = await service.usersWithRole('editor');
    expect(users).toEqual(
      expect.arrayContaining([
        { type: 'user', id: '1' },
        { type: 'user', id: '2' },
        { type: 'user', id: '3' },
      ]),
    );
    expect(users).toHaveLength(3);
  });

  it('dedups when the same (type,id) comes from two sources', async () => {
    const { store, service } = makeService({
      resolveRoleMembers: () => ['1'], // same as the store ref below
      resolveGlobalRoleMembers: () => ['1'], // and the global seam too
    });
    await store.assignRole({ type: 'user', id: '1' }, 'editor');

    const users = await service.usersWithRole('editor');
    expect(users).toEqual([{ type: 'user', id: '1' }]);
  });

  it('normalizes bare-string ids to the default user type', async () => {
    const { service } = makeService({
      resolveRoleMembers: () => ['42'],
      resolveGlobalRoleMembers: () => [7], // number id too
    });
    const users = await service.usersWithRole('editor');
    expect(users).toEqual(
      expect.arrayContaining([
        { type: 'user', id: '42' },
        { type: 'user', id: '7' },
      ]),
    );
    expect(users).toHaveLength(2);
  });

  it('normalizes UserRefInput objects (keeping their type)', async () => {
    const { service } = makeService({
      resolveRoleMembers: () => [{ type: 'account', id: 'abc' }],
      resolveGlobalRoleMembers: () => [{ id: 9 }], // no type → default 'user'
    });
    const users = await service.usersWithRole('editor');
    expect(users).toEqual(
      expect.arrayContaining([
        { type: 'account', id: 'abc' },
        { type: 'user', id: '9' },
      ]),
    );
    expect(users).toHaveLength(2);
  });

  it('treats absent seams as empty (store-only results)', async () => {
    const { store, service } = makeService();
    await store.assignRole({ type: 'user', id: '1' }, 'editor');
    await store.assignRole({ type: 'user', id: '2' }, 'editor');
    const users = await service.usersWithRole('editor');
    expect(users).toEqual(
      expect.arrayContaining([
        { type: 'user', id: '1' },
        { type: 'user', id: '2' },
      ]),
    );
    expect(users).toHaveLength(2);
  });

  it('returns [] for a role nobody holds', async () => {
    const { service } = makeService();
    expect(await service.usersWithRole('ghost')).toEqual([]);
  });

  it('runs the three sources in parallel', async () => {
    const order: string[] = [];
    const slow = (label: string, ms: number, ids: string[]) => () =>
      new Promise<string[]>((r) => {
        order.push(`start:${label}`);
        setTimeout(() => {
          order.push(`end:${label}`);
          r(ids);
        }, ms);
      });
    const { service } = makeService({
      resolveRoleMembers: slow('domain', 30, ['2']),
      resolveGlobalRoleMembers: slow('global', 10, ['3']),
    });
    const users = await service.usersWithRole('editor');
    expect(users).toEqual(
      expect.arrayContaining([
        { type: 'user', id: '2' },
        { type: 'user', id: '3' },
      ]),
    );
    // Both started before either finished → concurrent, not sequential.
    expect(order.slice(0, 2)).toEqual(expect.arrayContaining(['start:domain', 'start:global']));
    expect(order.indexOf('end:global')).toBeLessThan(order.indexOf('end:domain'));
  });

  it('passes the resolved tenant scope to the store and seams', async () => {
    let seamScope: string | undefined = 'unset';
    const { store, service } = makeService({
      tenant: () => 'acme',
      resolveRoleMembers: (_role, scope) => {
        seamScope = scope?.tenantId;
        return [];
      },
    });
    await store.assignRole({ type: 'user', id: '1' }, 'editor', { tenantId: 'acme' });
    // The store's tenant-visibility means the acme assignee shows only under acme scope.
    const users = await service.usersWithRole('editor');
    expect(users).toEqual([{ type: 'user', id: '1' }]);
    expect(seamScope).toBe('acme');
  });
});
