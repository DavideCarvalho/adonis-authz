import type { AuthzService, TenantScope } from '@adonis-agora/authz';

/**
 * O payload que o host compartilha via Inertia; o `<Can>`/`useCan`/`useAuthz`
 * do cliente decidem a partir dele.
 */
export interface AuthzShare {
  roles: string[];
  permissions: string[];
}

/**
 * Monta o share de autorização a partir do `AuthzService` para um usuário.
 * Roda no servidor (o host chama no seu middleware Inertia). Usa
 * `effectiveRoles`/`effectivePermissions` (store ∪ roleGrants ∪ resolveRoles
 * ∪ contexto) — as MESMAS que `can()` usa — para o gating de UI casar com a
 * decisão de servidor. `null`/`undefined` (anônimo) devolve o share vazio.
 */
export async function buildAuthzShare(
  authz: Pick<AuthzService, 'effectiveRoles' | 'effectivePermissions'>,
  user: unknown | null,
  scope?: TenantScope,
): Promise<AuthzShare> {
  if (user === null || user === undefined) return { roles: [], permissions: [] };
  const [roles, permissions] = await Promise.all([
    authz.effectiveRoles(user, scope),
    authz.effectivePermissions(user, scope),
  ]);
  return { roles, permissions };
}
