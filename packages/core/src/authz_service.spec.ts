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
