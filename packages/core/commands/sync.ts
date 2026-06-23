import { BaseCommand } from '@adonisjs/core/ace';
import type { CommandOptions } from '@adonisjs/core/types/ace';
import { AuthzService } from '../src/authz_service.js';
import type { AuthzConfig } from '../src/define_config.js';

/**
 * `node ace authz:sync` — seed roles and permissions from the `catalog` declared
 * in `config/authz.ts`. Idempotent: it only creates/attaches missing rows.
 */
export default class AuthzSync extends BaseCommand {
  static override commandName = 'authz:sync';
  static override description = 'Seed roles and permissions from the config catalog';
  static override options: CommandOptions = { startApp: true };

  override async run(): Promise<void> {
    const authz = await this.app.container.make(AuthzService);
    const config = this.app.config.get<AuthzConfig>('authz', {});
    const catalog = config.catalog;

    if (!catalog || (!catalog.permissions?.length && !catalog.roles)) {
      this.logger.warning('No catalog declared in config/authz.ts — nothing to sync.');
      return;
    }

    for (const permission of catalog.permissions ?? []) {
      await authz.store.createPermission(permission);
    }

    let grants = 0;
    for (const [role, permissions] of Object.entries(catalog.roles ?? {})) {
      await authz.store.createRole(role);
      for (const permission of permissions) {
        await authz.store.givePermissionToRole(role, permission);
        grants++;
      }
    }

    const roleCount = Object.keys(catalog.roles ?? {}).length;
    this.logger.success(`Synced ${roleCount} role(s) and ${grants} grant(s) from the catalog.`);
  }
}
