/**
 * Structural, dependency-free bridge to the Agora runtime context.
 *
 * The Agora context library publishes a READ accessor on a well-known global
 * symbol slot. We never import that package — we read the slot structurally, so
 * authz has zero hard dependency on it. When the slot is absent (authz used
 * standalone), every reader degrades to `undefined` and default behavior is
 * unchanged.
 */

/** The symbol slot the Agora context library writes its read accessor into. */
export const AGORA_CONTEXT_ACCESSOR = Symbol.for('@agora/context:accessor');

/**
 * The shape we read from the accessor slot. Deliberately minimal and tolerant:
 * fields are optional and `get()` returns the per-key value store written by
 * upstream libraries (e.g. authkit writes `globalRoles`).
 */
export interface AgoraContextAccessor {
  traceId?: string;
  tenantId?: string;
  userRef?: { type?: string; id?: string | number };
  /** Read an arbitrary context store value by key (structural). */
  get?: (key: string) => unknown;
}

/** Read the active Agora context accessor from the global slot, if present. */
export function readContextAccessor(): AgoraContextAccessor | undefined {
  const slot = (globalThis as Record<symbol, unknown>)[AGORA_CONTEXT_ACCESSOR];
  if (slot == null || typeof slot !== 'object') return undefined;
  return slot as AgoraContextAccessor;
}

/** The active tenant id from the Agora context, or `undefined` when unset. */
export function tenantFromContext(): string | undefined {
  const accessor = readContextAccessor();
  const tenantId = accessor?.tenantId;
  return typeof tenantId === 'string' && tenantId.length > 0 ? tenantId : undefined;
}

/**
 * Read a value from the active Agora context store (the `get()` accessor),
 * tolerant of a missing slot or accessor.
 */
export function readContextValue(key: string): unknown {
  const accessor = readContextAccessor();
  if (typeof accessor?.get !== 'function') return undefined;
  try {
    return accessor.get(key);
  } catch {
    return undefined;
  }
}

/**
 * The user's global roles as written by authkit into the context store under
 * the `globalRoles` key. Returns `[]` when absent or malformed.
 */
export function globalRolesFromContext(): string[] {
  const value = readContextValue('globalRoles');
  if (!Array.isArray(value)) return [];
  return value.filter((r): r is string => typeof r === 'string');
}
