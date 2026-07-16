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

  // The real @adonis-agora/context accessor implements get() → the whole store, and
  // NOTHING else. Earlier versions of these tests faked `get(key) => store[key]`,
  // a contract the context lib never shipped — which is exactly why the bug (authz
  // getting the whole store back and its Array.isArray failing) went unnoticed.
  it('reads global roles from the real accessor shape (get() → whole store)', () => {
    setAccessor({ get: () => ({ traceId: 't1', globalRoles: ['super-admin', 'auditor'] }) });
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
    setAccessor({ get: () => ({ globalRoles: ['admin', 42, null] }) });
    expect(globalRolesFromContext()).toEqual(['admin']);
  });

  it('returns [] when the store has no globalRoles key', () => {
    setAccessor({ get: () => ({ traceId: 't1' }) });
    expect(globalRolesFromContext()).toEqual([]);
  });
});
