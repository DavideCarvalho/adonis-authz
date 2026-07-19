import type { ApplicationService } from '@adonisjs/core/types';

/**
 * The booted {@link ApplicationService}, captured by `AuthzProvider.register()` — which the
 * application instantiates with its OWN booted app instance.
 *
 * Why capture it here instead of `import app from '@adonisjs/core/services/app'`: in a pnpm
 * (workspace / hoisted) install this package can resolve a DIFFERENT physical copy of
 * `@adonisjs/core` than the one `bin/server` booted. `services/app` exposes the app through a
 * module-level binding set at boot (`setApp`), so a non-booted copy's binding stays `undefined` —
 * importing it there yields an undefined app (`Cannot read properties of undefined`). The instance
 * the provider receives is always the booted one, so reading it here is immune to core copy /
 * peer-variant splits.
 */
let bootedApp: ApplicationService | undefined;

/** Record the booted app. Called once by {@link AuthzProvider} during `register()`. */
export function setBootedApp(app: ApplicationService): void {
  bootedApp = app;
}

/**
 * The booted app captured by the provider. Throws if read before the provider registered — a clear
 * signal that `@adonis-agora/authz/authz_provider` is missing from the app's providers.
 */
export function getBootedApp(): ApplicationService {
  if (!bootedApp) {
    throw new Error(
      '@adonis-agora/authz: app accessed before AuthzProvider registered. Add "@adonis-agora/authz/authz_provider" to your adonisrc.ts providers.',
    );
  }
  return bootedApp;
}
