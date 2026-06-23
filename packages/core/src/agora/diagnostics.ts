/**
 * Structural bridge to the Agora diagnostics bus.
 *
 * `@adonis-agora/diagnostics` is an OPTIONAL peer. We resolve its `onDiagnostic`
 * subscriber via the package when installed, and otherwise degrade to a no-op.
 * authz never hard-depends on it.
 */

/** The symbol slot the diagnostics library writes its `emit` function into. */
export const AGORA_DIAGNOSTICS_EMIT = Symbol.for('@agora/diagnostics:emit');

/** A diagnostics event as published by authkit on channel `agora:authkit:<type>`. */
export interface DiagnosticEvent {
  /** Event type, e.g. `account.created`, `organization.created`, `member.added`. */
  type?: string;
  /** Arbitrary structured payload (e.g. `{ orgId, userRef }`). */
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Subscriber signature exposed by `@adonis-agora/diagnostics`. */
export type OnDiagnostic = (
  lib: string,
  event: string | undefined,
  handler: (event: DiagnosticEvent) => void | Promise<void>,
) => undefined | (() => void);

/**
 * Resolve `onDiagnostic` from `@adonis-agora/diagnostics` (optional peer),
 * structurally. Returns `undefined` when the package is not installed.
 */
export async function resolveOnDiagnostic(): Promise<OnDiagnostic | undefined> {
  try {
    // Computed specifier so TypeScript does not require the optional peer to be
    // installed to typecheck. Resolved at runtime only when present.
    const specifier = '@adonis-agora/diagnostics';
    const mod = (await import(/* @vite-ignore */ specifier)) as {
      onDiagnostic?: OnDiagnostic;
    };
    return typeof mod.onDiagnostic === 'function' ? mod.onDiagnostic : undefined;
  } catch {
    return undefined;
  }
}
