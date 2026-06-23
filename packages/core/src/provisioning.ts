/**
 * Feature A — event-driven provisioning.
 *
 * Opt-in: only active when the host calls {@link defineAuthzProvisioning}. It
 * subscribes to the Agora diagnostics bus (via `@adonis-agora/diagnostics`
 * `onDiagnostic`, an OPTIONAL structural peer) for `authkit:*` events and runs a
 * config-mapped action against a {@link PermissionStore}. Best-effort: actions
 * never throw out of the handler, and a missing diagnostics package is a no-op.
 */

import { type DiagnosticEvent, resolveOnDiagnostic } from './agora/diagnostics.js';
import type { PermissionStore } from './store.js';

/** An action run when a mapped authkit event fires. Best-effort; may be async. */
export type ProvisioningAction = (
  event: DiagnosticEvent,
  store: PermissionStore,
) => void | Promise<void>;

export interface AuthzProvisioningConfig {
  /** The store provisioning actions mutate. */
  store: PermissionStore;
  /**
   * Map of authkit event type → action. Keys are the bare event type as
   * published by authkit, e.g. `organization.created`, `member.added`,
   * `account.created`. The library subscribes on channels `agora:authkit:*`.
   */
  on: Record<string, ProvisioningAction>;
  /**
   * Optional error sink for best-effort action failures. Defaults to a no-op so
   * provisioning never throws into the host.
   */
  onError?: (error: unknown, event: DiagnosticEvent) => void;
}

/** A handle returned by {@link defineAuthzProvisioning} to tear down subscriptions. */
export interface AuthzProvisioning {
  /** Unsubscribe all handlers. Safe to call multiple times. */
  stop: () => void;
}

/**
 * Wire authkit diagnostics events to provisioning actions. Returns a handle to
 * stop. When `@adonis-agora/diagnostics` is not installed, this resolves to an
 * inert handle (no-op) — provisioning is purely opt-in and never required.
 */
export async function defineAuthzProvisioning(
  config: AuthzProvisioningConfig,
): Promise<AuthzProvisioning> {
  const onDiagnostic = await resolveOnDiagnostic();
  if (!onDiagnostic) {
    return { stop: () => {} };
  }

  const onError =
    config.onError ??
    (() => {
      /* best-effort: swallow */
    });

  const disposers: Array<() => void> = [];

  for (const [eventType, action] of Object.entries(config.on)) {
    const handler = async (event: DiagnosticEvent): Promise<void> => {
      try {
        await action(event, config.store);
      } catch (error) {
        try {
          onError(error, event);
        } catch {
          /* never throw out of provisioning */
        }
      }
    };
    const dispose = onDiagnostic('authkit', eventType, handler);
    if (typeof dispose === 'function') disposers.push(dispose);
  }

  return {
    stop: () => {
      for (const dispose of disposers.splice(0)) {
        try {
          dispose();
        } catch {
          /* ignore */
        }
      }
    },
  };
}

export type { DiagnosticEvent } from './agora/diagnostics.js';
