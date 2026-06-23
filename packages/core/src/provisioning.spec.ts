import { describe, expect, it, vi } from 'vitest';
import type { DiagnosticEvent, OnDiagnostic } from './agora/diagnostics.js';
import { defineAuthzProvisioning } from './provisioning.js';
import { MemoryPermissionStore } from './stores/memory.js';

// Mock the optional diagnostics peer so the structural import resolves in tests.
vi.mock('@adonis-agora/diagnostics', () => {
  type Handler = (e: DiagnosticEvent) => void | Promise<void>;
  const handlers = new Map<string, Handler>();
  const onDiagnostic: OnDiagnostic = (lib, event, handler) => {
    const key = `${lib}:${event}`;
    handlers.set(key, handler);
    return () => handlers.delete(key);
  };
  // Test seam to drive events.
  (onDiagnostic as unknown as { __emit: (k: string, e: DiagnosticEvent) => unknown }).__emit = (
    key: string,
    event: DiagnosticEvent,
  ) => handlers.get(key)?.(event);
  return { onDiagnostic };
});

async function emitter() {
  const mod = (await import('@adonis-agora/diagnostics')) as unknown as {
    onDiagnostic: { __emit: (k: string, e: DiagnosticEvent) => Promise<unknown> };
  };
  return mod.onDiagnostic.__emit;
}

describe('feature A — event-driven provisioning', () => {
  it('runs the mapped action when an authkit event fires', async () => {
    const store = new MemoryPermissionStore();
    const emit = await emitter();

    const provisioning = await defineAuthzProvisioning({
      store,
      on: {
        'organization.created': async (ev, s) => {
          const orgId = ev.metadata?.orgId as string;
          await s.assignRole({ type: 'user', id: '1' }, 'org:owner', { tenantId: orgId });
        },
      },
    });

    await emit('authkit:organization.created', { metadata: { orgId: 'acme' } });

    expect(await store.getRolesForUser({ type: 'user', id: '1' }, { tenantId: 'acme' })).toContain(
      'org:owner',
    );
    provisioning.stop();
  });

  it('is best-effort: a throwing action never propagates and calls onError', async () => {
    const store = new MemoryPermissionStore();
    const emit = await emitter();
    const errors: unknown[] = [];

    const provisioning = await defineAuthzProvisioning({
      store,
      onError: (e) => errors.push(e),
      on: {
        'member.added': () => {
          throw new Error('boom');
        },
      },
    });

    await expect(emit('authkit:member.added', { metadata: {} })).resolves.not.toThrow();
    expect(errors).toHaveLength(1);
    provisioning.stop();
  });

  it('stop() unsubscribes handlers', async () => {
    const store = new MemoryPermissionStore();
    const emit = await emitter();
    let calls = 0;

    const provisioning = await defineAuthzProvisioning({
      store,
      on: { 'account.created': () => void calls++ },
    });
    provisioning.stop();
    await emit('authkit:account.created', {});
    expect(calls).toBe(0);
  });
});
