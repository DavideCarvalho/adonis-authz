import { afterEach, describe, expect, it } from 'vitest';
import { AGORA_CONTEXT_ACCESSOR } from './agora/context.js';
import { AuthzService } from './authz_service.js';
import { MemoryPermissionStore } from './stores/memory.js';

type GlobalSlots = Record<symbol, unknown>;

function setContext(value: unknown): void {
  (globalThis as GlobalSlots)[AGORA_CONTEXT_ACCESSOR] = value;
}

afterEach(() => {
  delete (globalThis as GlobalSlots)[AGORA_CONTEXT_ACCESSOR];
});

const user = { id: '1', type: 'user' };

describe('feature B — tenant auto-scope', () => {
  it('default (no resolveTenant) ignores context tenant — behavior unchanged', async () => {
    const store = new MemoryPermissionStore();
    await store.givePermissionToRole('viewer', 'reports.view');
    await store.assignRole({ type: 'user', id: '1' }, 'viewer', { tenantId: 'acme' });
    const service = new AuthzService({ store });

    setContext({ tenantId: 'acme' });
    // Without opt-in, the check is global '' → tenant-scoped grant invisible.
    expect(await service.can(user, 'reports.view')).toBe(false);
  });

  it("resolveTenant: 'context' defaults the tenant to the context tenantId", async () => {
    const store = new MemoryPermissionStore();
    await store.givePermissionToRole('viewer', 'reports.view');
    await store.assignRole({ type: 'user', id: '1' }, 'viewer', { tenantId: 'acme' });
    const service = new AuthzService({ store, resolveTenant: 'context' });

    setContext({ tenantId: 'acme' });
    expect(await service.can(user, 'reports.view')).toBe(true);

    setContext({ tenantId: 'other' });
    expect(await service.can(user, 'reports.view')).toBe(false);
  });

  it('explicit scope wins over the context', async () => {
    const store = new MemoryPermissionStore();
    await store.givePermissionToRole('viewer', 'reports.view');
    await store.assignRole({ type: 'user', id: '1' }, 'viewer', { tenantId: 'acme' });
    const service = new AuthzService({ store, resolveTenant: 'context' });

    setContext({ tenantId: 'other' });
    expect(await service.can(user, 'reports.view', { scope: { tenantId: 'acme' } })).toBe(true);
  });

  it('accepts a custom resolveTenant function', async () => {
    const store = new MemoryPermissionStore();
    await store.givePermissionToRole('viewer', 'reports.view');
    await store.assignRole({ type: 'user', id: '1' }, 'viewer', { tenantId: 't9' });
    const service = new AuthzService({ store, resolveTenant: () => 't9' });
    expect(await service.can(user, 'reports.view')).toBe(true);
  });
});

describe('feature C — global-role bridge', () => {
  it('super-admin global role short-circuits allow', async () => {
    const store = new MemoryPermissionStore();
    const service = new AuthzService({ store, superAdminRoles: ['platform:super'] });

    setContext({ get: () => ['platform:super'] });
    expect(await service.can(user, 'anything.at.all')).toBe(true);
    expect(await service.hasRole(user, 'whatever')).toBe(true);
  });

  it('globalRoleGrants are unioned into the permission check', async () => {
    const store = new MemoryPermissionStore();
    const service = new AuthzService({
      store,
      globalRoleGrants: { auditor: ['audit.*'] },
    });

    setContext({ get: () => ['auditor'] });
    expect(await service.can(user, 'audit.read')).toBe(true);
    expect(await service.can(user, 'posts.edit')).toBe(false);
  });

  it('default (no config) ignores context global roles — behavior unchanged', async () => {
    const store = new MemoryPermissionStore();
    const service = new AuthzService({ store });
    setContext({ get: () => ['platform:super'] });
    expect(await service.can(user, 'anything')).toBe(false);
  });

  it('no context → falls through to normal RBAC', async () => {
    const store = new MemoryPermissionStore();
    await store.givePermissionToRole('editor', 'posts.edit');
    await store.assignRole({ type: 'user', id: '1' }, 'editor');
    const service = new AuthzService({
      store,
      superAdminRoles: ['platform:super'],
      globalRoleGrants: { auditor: ['audit.*'] },
    });
    expect(await service.can(user, 'posts.edit')).toBe(true);
    expect(await service.can(user, 'audit.read')).toBe(false);
  });
});
