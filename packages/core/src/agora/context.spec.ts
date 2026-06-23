import { afterEach, describe, expect, it } from 'vitest';
import {
  AGORA_CONTEXT_ACCESSOR,
  globalRolesFromContext,
  readContextValue,
  tenantFromContext,
} from './context.js';

type GlobalSlots = Record<symbol, unknown>;

function setAccessor(value: unknown): void {
  (globalThis as GlobalSlots)[AGORA_CONTEXT_ACCESSOR] = value;
}

afterEach(() => {
  delete (globalThis as GlobalSlots)[AGORA_CONTEXT_ACCESSOR];
});

describe('agora context bridge', () => {
  it('returns undefined when no accessor slot is present', () => {
    expect(tenantFromContext()).toBeUndefined();
    expect(globalRolesFromContext()).toEqual([]);
    expect(readContextValue('globalRoles')).toBeUndefined();
  });

  it('reads tenantId structurally from the accessor', () => {
    setAccessor({ tenantId: 'acme' });
    expect(tenantFromContext()).toBe('acme');
  });

  it('treats empty-string tenantId as no tenant', () => {
    setAccessor({ tenantId: '' });
    expect(tenantFromContext()).toBeUndefined();
  });

  it('reads global roles via the get() store accessor', () => {
    const store: Record<string, unknown> = { globalRoles: ['super-admin', 'auditor'] };
    setAccessor({ get: (k: string) => store[k] });
    expect(globalRolesFromContext()).toEqual(['super-admin', 'auditor']);
  });

  it('tolerates a throwing get() accessor', () => {
    setAccessor({
      get: () => {
        throw new Error('boom');
      },
    });
    expect(globalRolesFromContext()).toEqual([]);
  });

  it('filters non-string global roles', () => {
    setAccessor({ get: () => ['admin', 42, null] });
    expect(globalRolesFromContext()).toEqual(['admin']);
  });
});
