---
'@adonis-agora/authz': patch
---

Make the `@adonis-agora/authz/services/main` service singleton resolve the app from the instance `AuthzProvider` captures at registration, instead of `import app from '@adonisjs/core/services/app'`. In a pnpm workspace/hoisted install the package can resolve a different physical copy of `@adonisjs/core` than the one `bin/server` booted, whose `services/app` binding is never set — so the imported `app` was `undefined` and every call threw. The provider-captured instance is always the booted one, immune to core copy / peer-variant splits.
