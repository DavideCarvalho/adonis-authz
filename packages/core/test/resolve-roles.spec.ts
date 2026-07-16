import { afterEach, describe, expect, it } from 'vitest';
import { AuthzService } from '../src/authz_service.js';
import { MemoryPermissionStore } from '../src/stores/memory.js';

const ACCESSOR = Symbol.for('@agora/context:accessor');
type Slots = Record<symbol, unknown>;
function setContextRoles(roles: string[]): void {
  (globalThis as Slots)[ACCESSOR] = { get: () => ({ globalRoles: roles }) };
}
afterEach(() => {
  delete (globalThis as Slots)[ACCESSOR];
});

function svc(opts: Partial<ConstructorParameters<typeof AuthzService>[0]> = {}) {
  return new AuthzService({ store: new MemoryPermissionStore(), ...opts });
}

describe('resolveRoles seam + roleGrants', () => {
  it('grants a permission from an app-role returned by resolveRoles', async () => {
    const authz = svc({
      resolveRoles: async (ref) => (ref.id === 'u1' ? ['COORDINATOR'] : []),
      roleGrants: { COORDINATOR: ['agent.coordenador.*'] },
    });
    expect(await authz.can({ id: 'u1' }, 'agent.coordenador.reatribuir')).toBe(true);
    expect(await authz.can({ id: 'u2' }, 'agent.coordenador.reatribuir')).toBe(false);
  });

  it('unions resolver roles with context (token) roles under roleGrants', async () => {
    setContextRoles(['ADMIN']);
    const authz = svc({
      resolveRoles: async () => ['COORDINATOR'],
      roleGrants: { ADMIN: ['sys.*'], COORDINATOR: ['agent.coordenador.*'] },
    });
    expect(await authz.can({ id: 'u1' }, 'sys.reboot')).toBe(true); // do token
    expect(await authz.can({ id: 'u1' }, 'agent.coordenador.reatribuir')).toBe(true); // do resolver
  });

  it('without resolveRoles, only context roles + store decide (fail-closed default)', async () => {
    const authz = svc({ roleGrants: { COORDINATOR: ['agent.coordenador.*'] } });
    expect(await authz.can({ id: 'u1' }, 'agent.coordenador.reatribuir')).toBe(false);
  });

  it('hasRole reflects resolver roles', async () => {
    const authz = svc({ resolveRoles: async () => ['COORDINATOR'] });
    expect(await authz.hasRole({ id: 'u1' }, 'COORDINATOR')).toBe(true);
    expect(await authz.hasRole({ id: 'u1' }, 'ADMIN')).toBe(false);
  });
});
