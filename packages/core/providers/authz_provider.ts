import type { ApplicationService } from '@adonisjs/core/types';
import { AuthzService } from '../src/authz_service.js';
import type { AuthzConfig } from '../src/define_config.js';

/**
 * Registers the {@link AuthzService} as a container singleton built from the
 * active store driver in `config/authz.ts`. The Bouncer abilities published into
 * `app/abilities/authz.ts` resolve this service to answer DB-backed checks.
 *
 * Resolve it anywhere via:
 *
 * ```ts
 * const authz = await app.container.make(AuthzService)
 * ```
 */
export default class AuthzProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton(AuthzService, async () => {
      const config = this.app.config.get<AuthzConfig>('authz', {});
      const {
        default: defaultStore,
        stores: providers,
        superAdmin,
        resolveUserRef,
        tenant,
      } = config;

      if (!providers || Object.keys(providers).length === 0) {
        throw new Error('@adonis-agora/authz: config.stores is empty — define at least one store.');
      }

      const activeKey = defaultStore ?? Object.keys(providers)[0];
      if (!activeKey || !providers[activeKey]) {
        throw new Error(
          `@adonis-agora/authz: config.default is "${String(defaultStore)}", but config.stores.${String(
            defaultStore,
          )} is not defined`,
        );
      }

      const store = await providers[activeKey]({ app: this.app });

      return new AuthzService({
        store,
        ...(superAdmin !== undefined ? { superAdmin } : {}),
        ...(resolveUserRef !== undefined ? { resolveUserRef } : {}),
        ...(tenant !== undefined ? { tenant } : {}),
      });
    });
  }
}
