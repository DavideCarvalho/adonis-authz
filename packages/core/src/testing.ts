import { describe, expect, it } from 'vitest';
import type { PermissionStore } from './store.js';
import type { UserRef } from './user_ref.js';

/** Factory producing a FRESH, isolated store for each test. */
export type StoreFactory = () => PermissionStore | Promise<PermissionStore>;

const alice: UserRef = { type: 'user', id: '1' };
const bob: UserRef = { type: 'user', id: '2' };

/**
 * The shared {@link PermissionStore} contract suite. Each store driver re-runs
 * it (see the memory and Lucid `*.contract.spec.ts`). Exposed on the public
 * `@agora/authz/testing` subpath so downstream stores can self-validate.
 */
export function runPermissionStoreContract(name: string, factory: StoreFactory): void {
  describe(`PermissionStore contract: ${name}`, () => {
    it('creates roles and permissions idempotently', async () => {
      const store = await factory();
      const r1 = await store.createRole('admin');
      const r2 = await store.createRole('admin');
      expect(r1).toBe(r2);
      const p1 = await store.createPermission('posts.edit');
      const p2 = await store.createPermission('posts.edit');
      expect(p1).toBe(p2);
      expect(await store.listRoles()).toContain('admin');
      expect(await store.listPermissions()).toContain('posts.edit');
    });

    it('grants permissions to a role and resolves them for assigned users', async () => {
      const store = await factory();
      await store.givePermissionToRole('editor', 'posts.edit');
      await store.assignRole(alice, 'editor');
      expect(await store.getRolesForUser(alice)).toContain('editor');
      expect(await store.getPermissionsForUser(alice)).toContain('posts.edit');
      expect(await store.userHasPermission(alice, 'posts.edit')).toBe(true);
      expect(await store.userHasPermission(bob, 'posts.edit')).toBe(false);
    });

    it('revokes a permission from a role', async () => {
      const store = await factory();
      await store.givePermissionToRole('editor', 'posts.edit');
      await store.assignRole(alice, 'editor');
      await store.revokePermissionFromRole('editor', 'posts.edit');
      expect(await store.userHasPermission(alice, 'posts.edit')).toBe(false);
    });

    it('removes a role from a user', async () => {
      const store = await factory();
      await store.givePermissionToRole('editor', 'posts.edit');
      await store.assignRole(alice, 'editor');
      await store.removeRole(alice, 'editor');
      expect(await store.getRolesForUser(alice)).not.toContain('editor');
      expect(await store.userHasPermission(alice, 'posts.edit')).toBe(false);
    });

    it('supports direct user permission grants (tenant-independent)', async () => {
      const store = await factory();
      await store.giveUserPermission(alice, 'billing.view');
      expect(await store.userHasPermission(alice, 'billing.view')).toBe(true);
      // Direct grants apply regardless of tenant.
      expect(await store.userHasPermission(alice, 'billing.view', { tenantId: 't1' })).toBe(true);
      await store.revokeUserPermission(alice, 'billing.view');
      expect(await store.userHasPermission(alice, 'billing.view')).toBe(false);
    });

    it('keeps a role-derived permission after revoking only the direct grant', async () => {
      const store = await factory();
      await store.givePermissionToRole('editor', 'posts.edit');
      await store.assignRole(alice, 'editor');
      await store.giveUserPermission(alice, 'posts.edit');
      await store.revokeUserPermission(alice, 'posts.edit');
      // Still granted via the role.
      expect(await store.userHasPermission(alice, 'posts.edit')).toBe(true);
    });

    it('isolates assignments per user', async () => {
      const store = await factory();
      await store.givePermissionToRole('editor', 'posts.edit');
      await store.assignRole(alice, 'editor');
      expect(await store.getPermissionsForUser(bob)).toHaveLength(0);
    });

    it('honors tenant visibility', async () => {
      const store = await factory();
      await store.givePermissionToRole('editor', 'posts.edit');
      await store.givePermissionToRole('viewer', 'posts.view');
      // Global assignment.
      await store.assignRole(alice, 'editor');
      // Tenant-scoped assignment.
      await store.assignRole(alice, 'viewer', { tenantId: 't1' });

      // Global request: only global rows.
      expect(await store.getRolesForUser(alice)).toEqual(['editor']);
      expect(await store.userHasPermission(alice, 'posts.view')).toBe(false);

      // Tenant request: global + that tenant.
      const tenantRoles = await store.getRolesForUser(alice, { tenantId: 't1' });
      expect(tenantRoles).toEqual(expect.arrayContaining(['editor', 'viewer']));
      expect(await store.userHasPermission(alice, 'posts.view', { tenantId: 't1' })).toBe(true);
      // A different tenant does not see t1's grant.
      expect(await store.userHasPermission(alice, 'posts.view', { tenantId: 't2' })).toBe(false);
    });

    it('respects the polymorphic user type', async () => {
      const store = await factory();
      const adminUser: UserRef = { type: 'admin', id: '1' };
      await store.givePermissionToRole('superuser', 'system.manage');
      await store.assignRole(adminUser, 'superuser');
      // Same id, different type → no grant.
      expect(await store.userHasPermission({ type: 'user', id: '1' }, 'system.manage')).toBe(false);
      expect(await store.userHasPermission(adminUser, 'system.manage')).toBe(true);
    });

    it('lists permissions attached to a role', async () => {
      const store = await factory();
      await store.givePermissionToRole('editor', 'posts.edit');
      await store.givePermissionToRole('editor', 'posts.delete');
      const perms = await store.getRolePermissions('editor');
      expect(perms).toEqual(expect.arrayContaining(['posts.edit', 'posts.delete']));
    });
  });
}
