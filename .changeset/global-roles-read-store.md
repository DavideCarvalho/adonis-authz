---
'@adonis-agora/authz': patch
---

Corrige a leitura das global roles do contexto: `globalRoleGrants` e o super-admin por role
global voltam a funcionar.

O bridge lia `accessor.get('globalRoles')`, mas o accessor do `@adonis-agora/context` implementava
só `get()` (o store inteiro) — a chave era ignorada e vinha o store, o `Array.isArray` falhava, e
`globalRolesFromContext()` devolvia `[]`. Resultado: toda permissão concedida por global role
negava, em silêncio. Agora o bridge lê `get()` e indexa a chave localmente, o que funciona com
qualquer versão do context (a forma sem argumento sempre existiu).

Os testes do bridge falseavam `get(key) => valor` e `get() => valor-desembrulhado` — dois contratos
que o context nunca shippou. Reescritos para a forma real (`get() => store`), que é o que deixava o
bug invisível.
