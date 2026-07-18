---
'@adonis-agora/authz': minor
---

`AuthzRoleMiddleware` agora recebe o `AuthzService` por injeção de construtor (`@inject()`) em vez de
resolver pelo container no meio do `handle` (service locator). O container do Adonis instancia o
middleware por request e injeta o serviço — DI idiomática, sem `container.make` no fluxo.

O build passou a emitir `emitDecoratorMetadata`, necessário para o container ler os tipos do
construtor. Consumidores que registram o middleware como named middleware
(`() => import('@adonis-agora/authz/middleware')`) não precisam mudar nada.
