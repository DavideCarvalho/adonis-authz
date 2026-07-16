---
'@adonis-agora/authz': minor
---

Export standalone Lucid schema helpers `createAuthzTables`, `dropAuthzTables`, and
`AUTHZ_TABLES`, so an app can create the RBAC tables from a Lucid migration instead of
relying on `autoCreateSchema`. This mirrors `@adonis-agora/durable`'s `createDurableTables`
and completes the ecosystem convention: a lib auto-manages its own tables by default
(`autoCreateSchema`, still the default), lets you disable that, and exposes the DDL as a
function you import into your own migration — the same code the store runs, so the two paths
can never drift.

Internals: the store's `ensureSchema` now delegates to `createAuthzTables`, and dialect
detection also reads a directly-exposed `dialect` (a deferred migration query client), not
only `connection().dialect`, so the migration path emits `TIMESTAMP` correctly on Postgres.
The `configure` migration stub now delegates to these helpers. No breaking changes.
