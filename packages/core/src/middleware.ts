import type { HttpContext } from '@adonisjs/core/http';
import app from '@adonisjs/core/services/app';
import type { NextFn } from '@adonisjs/core/types/http';
import { AuthzService } from './authz_service.js';
import type { TenantScope } from './user_ref.js';

/**
 * Estrutura mínima do `ctx.auth` que o middleware lê — estrutural, para funcionar com o
 * `Authenticator` do `@adonis-agora/authkit-client` (`getUser()`) ou com um guard `@adonisjs/auth`
 * (`.user`), sem depender de nenhum dos dois.
 */
interface AuthLike {
  getUser?: () => Promise<unknown>;
  user?: unknown;
}

export interface RequireRoleOptions {
  /** Papéis aceitos (any-of): passa se o usuário tiver PELO MENOS UM. */
  roles: string[];
  /** Escopo de tenant repassado a `effectiveRoles`. */
  scope?: TenantScope;
  /** Para onde redirecionar um request NÃO-autenticado. Sem isto → responde 401. */
  guestRedirect?: string;
  /** Para onde redirecionar quando falta o papel. Sem isto → responde 403. */
  deniedRedirect?: string;
  /** Mensagem do 403 quando não há `deniedRedirect`. Default `'Forbidden'`. */
  deniedMessage?: string;
}

/**
 * Middleware de rota que exige um dos `roles` via {@link AuthzService.effectiveRoles} (global ∪ app ∪
 * store) — cobre num só lugar tanto papéis globais (claim do token) quanto papéis de app (DB).
 * Substitui os middlewares "exige role X" que cada app reescreve por papel. Registre como named
 * middleware e passe os papéis por rota:
 *
 * ```ts
 * // start/kernel.ts
 * export const middleware = router.named({
 *   requireRole: () => import('@adonis-agora/authz/middleware'),
 * })
 * // rotas
 * router.get('/coordenador', ...).use(middleware.requireRole({ roles: ['COORDINATOR'] }))
 * router.get('/admin', ...).use(middleware.requireRole({ roles: ['ADMIN'], deniedRedirect: '/unauthorized' }))
 * ```
 *
 * O usuário vem de `ctx.auth.getUser()` (authkit) ou `ctx.auth.user`; `effectiveRoles` popula os
 * papéis globais do contexto no caminho, então `roles: ['ADMIN']` casa pelo claim do token.
 */
export default class AuthzRoleMiddleware {
  /**
   * Resolve o {@link AuthzService}. Default: pelo container (lazy, no request) — sem `@inject`, então
   * o Adonis instancia o middleware sem args. Um resolver é injetável para teste.
   */
  #resolveAuthz: () => Promise<AuthzService>;

  constructor(resolveAuthz?: () => Promise<AuthzService>) {
    this.#resolveAuthz = resolveAuthz ?? (() => app.container.make(AuthzService));
  }

  async handle(ctx: HttpContext, next: NextFn, options: RequireRoleOptions) {
    const auth = (ctx as unknown as { auth?: AuthLike }).auth;
    const user = auth ? ((await auth.getUser?.()) ?? auth.user ?? null) : null;
    if (user === null || user === undefined) {
      return options.guestRedirect
        ? ctx.response.redirect(options.guestRedirect)
        : ctx.response.unauthorized({ message: 'Unauthenticated' });
    }

    const authz = await this.#resolveAuthz();
    const roles = await authz.effectiveRoles(user, options.scope);
    if (!options.roles.some((role) => roles.includes(role))) {
      return options.deniedRedirect
        ? ctx.response.redirect(options.deniedRedirect)
        : ctx.response.forbidden({ message: options.deniedMessage ?? 'Forbidden' });
    }

    return next();
  }
}
