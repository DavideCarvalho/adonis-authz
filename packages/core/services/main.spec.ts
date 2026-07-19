import { beforeEach, describe, expect, it, vi } from 'vitest';

const { make } = vi.hoisted(() => ({ make: vi.fn() }));
vi.mock('@adonisjs/core/services/app', () => ({ default: { container: { make } } }));

describe('authz service singleton', () => {
  beforeEach(() => {
    make.mockReset();
    // Fresh module each test so the module-level memoization starts empty.
    vi.resetModules();
  });

  it('resolves the AuthzService from the container once and reuses it across calls', async () => {
    const authz = { can: vi.fn().mockResolvedValue(true) };
    make.mockResolvedValue(authz);
    const { default: service } = await import('./main.js');

    await expect(service.can({ id: 'u1' }, 'metrics.read')).resolves.toBe(true);
    await service.can({ id: 'u1' }, 'metrics.write');

    // One container resolution, shared by every forwarded call.
    expect(make).toHaveBeenCalledTimes(1);
    expect(authz.can).toHaveBeenNthCalledWith(1, { id: 'u1' }, 'metrics.read');
    expect(authz.can).toHaveBeenNthCalledWith(2, { id: 'u1' }, 'metrics.write');
  });

  it('forwards every async method to the resolved instance', async () => {
    const authz = {
      can: vi.fn().mockResolvedValue(true),
      scope: vi.fn().mockResolvedValue('scope-all'),
      hasRole: vi.fn().mockResolvedValue(true),
      hasAnyRole: vi.fn().mockResolvedValue(false),
      effectiveRoles: vi.fn().mockResolvedValue(['paciente']),
      effectivePermissions: vi.fn().mockResolvedValue(['metrics.read']),
    };
    make.mockResolvedValue(authz);
    const { default: service } = await import('./main.js');

    await expect(service.scope({ id: 'u1' }, 'exam')).resolves.toBe('scope-all');
    await expect(service.hasRole({ id: 'u1' }, 'paciente')).resolves.toBe(true);
    await expect(service.hasAnyRole({ id: 'u1' }, ['admin'])).resolves.toBe(false);
    await expect(service.effectiveRoles({ id: 'u1' })).resolves.toEqual(['paciente']);
    await expect(service.effectivePermissions({ id: 'u1' })).resolves.toEqual(['metrics.read']);
  });
});
