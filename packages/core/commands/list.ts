import { BaseCommand } from '@adonisjs/core/ace';
import type { CommandOptions } from '@adonisjs/core/types/ace';
import { AuthzService } from '../src/authz_service.js';

/** `node ace authz:list` — list roles (with their permissions) and permissions. */
export default class AuthzList extends BaseCommand {
  static override commandName = 'authz:list';
  static override description = 'List authz roles and permissions';
  static override options: CommandOptions = { startApp: true };

  override async run(): Promise<void> {
    const authz = await this.app.container.make(AuthzService);
    const roles = await authz.store.listRoles();
    const permissions = await authz.store.listPermissions();

    this.logger.log(this.colors.bold('Roles'));
    if (roles.length === 0) {
      this.logger.log('  (none)');
    } else {
      for (const role of roles) {
        const perms = await authz.store.getRolePermissions(role);
        this.logger.log(`  ${role}${perms.length ? ` → ${perms.join(', ')}` : ''}`);
      }
    }

    this.logger.log(this.colors.bold('Permissions'));
    this.logger.log(permissions.length ? `  ${permissions.join(', ')}` : '  (none)');
  }
}
