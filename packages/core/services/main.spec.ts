import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('authz service singleton', () => {
  beforeEach(() => {
    // Fresh module each test so the module-level memoization and captured app start empty.
    vi.resetModules();
  });

  it('throws a clear error when used before the provider set the booted app', async () => {
    const { default: service } = await import('./main.js');
    await expect(service.can({ id: 'u1' }, 'metrics.read')).rejects.toThrow(
      /AuthzProvider registered/,
    );
  });

  it('resolves the AuthzService from the captured app once and reuses it across calls', async () => {
    const authz = { can: vi.fn().mockResolvedValue(true) };
    const make = vi.fn().mockResolvedValue(authz);
    const { setBootedApp } = await import('./booted_app.js');
    setBootedApp({ container: { make } } as never);
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
    const { setBootedApp } = await import('./booted_app.js');
    setBootedApp({ container: { make: vi.fn().mockResolvedValue(authz) } } as never);
    const { default: service } = await import('./main.js');

    await expect(service.scope({ id: 'u1' }, 'exam')).resolves.toBe('scope-all');
    await expect(service.hasRole({ id: 'u1' }, 'paciente')).resolves.toBe(true);
    await expect(service.hasAnyRole({ id: 'u1' }, ['admin'])).resolves.toBe(false);
    await expect(service.effectiveRoles({ id: 'u1' })).resolves.toEqual(['paciente']);
    await expect(service.effectivePermissions({ id: 'u1' })).resolves.toEqual(['metrics.read']);
  });
});
