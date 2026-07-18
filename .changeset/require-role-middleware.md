---
'@adonis-agora/authz': minor
---

Novo middleware de rota `AuthzRoleMiddleware` (subpath `@adonis-agora/authz/middleware`) — exige um dos `roles` via `AuthzService.effectiveRoles` (global ∪ app ∪ store), cobrindo papéis globais (claim do token) e de app (DB) num só lugar. Substitui os middlewares "exige role X" que cada app reescreve por papel.

```ts
// start/kernel.ts
export const middleware = router.named({
  requireRole: () => import('@adonis-agora/authz/middleware'),
})
// rotas
router.get('/coord', ...).use(middleware.requireRole({ roles: ['COORDINATOR'] }))
router.get('/admin', ...).use(middleware.requireRole({ roles: ['ADMIN'], deniedRedirect: '/unauthorized' }))
```

Opções: `roles` (any-of), `scope`, `guestRedirect` (senão 401), `deniedRedirect`/`deniedMessage` (senão 403). Lê o usuário de `ctx.auth.getUser()` (authkit) ou `ctx.auth.user` — estrutural, sem depender do authkit. Resolve o `AuthzService` lazy do container (sem `@inject`/reflect-metadata).
