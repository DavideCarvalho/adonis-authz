---
"@adonis-agora/authz": patch
---

Fix the Lucid store crashing `AuthzService` construction with "Cannot read properties of undefined (reading 'booted')".

`stores.lucid()` resolved the database via `import('@adonisjs/lucid/services/db')`, whose module-level `app` can be `undefined` when the `AuthzService` singleton is built during boot (the service default is only assigned inside `app.booted(...)`, and a dynamic import from this package may resolve a different module copy). When it threw, `app.container.make(AuthzService)` threw too, taking down every consumer — notably the agent's `authzToolAuthorizer`, which is fail-closed and therefore denied ALL tools, leaving the model with none. The store now resolves the db via `ctx.app.container.make('lucid.db')` (the same binding `services/db` uses, registered in the database provider's `register()`), so it builds correctly at boot.
