/**
 * Contrato da shared-prop do Inertia que o host expõe via `buildAuthzShare`
 * (ver `./share.ts`, subpath `@adonis-agora/authz-react/server`).
 *
 * `roles`/`permissions` são as roles/permissões EFETIVAS do usuário
 * (`effectiveRoles`/`effectivePermissions` do `AuthzService`: store ∪
 * roleGrants ∪ resolveRoles ∪ contexto) — as MESMAS que `can()` usa no
 * servidor, para o gating de UI casar com a decisão de servidor.
 */
export interface AuthzSharedProps {
  authz: {
    roles: string[];
    permissions: string[];
  };
  /** escape hatch: o host é livre para adicionar outras shared props */
  [key: string]: unknown;
}
