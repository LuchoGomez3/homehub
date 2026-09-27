# Plan: reemplazar los tokens sin firma por JWT reales

- **Estado:** en curso
- **Bloque:** 1 de N
- **Alcance:** `apps/api` solamente. El frontend no se toca en este bloque.
  *Ampliado el 2026-09-12:* entra B3 (aislamiento entre familias), porque F7-1 exige
  cero errores de tipos y los de B3 no se pueden separar del arreglo.
- **Abre:** 2026-09-12
- **Origen:** [`analysis/2026-09-12-estado-inicial.md`](../analysis/2026-09-12-estado-inicial.md),
  hallazgos B1, B2, B4, B5, B6
- **Decisión de arquitectura:** [`decisions/0001`](../decisions/0001-sesion-en-cookies-httponly.md)

## Objetivo

Reemplazar los tokens base64 sin firma por JWT reales, con revocación en base de datos y
cookies `httpOnly` como única fuente de verdad.

El bloque cierra cuando **un token fabricado a mano devuelve 401** — la prueba que hoy daría
200.

## Cómo leer esta lista

- Los pasos marcados **`[discriminador]`** son los que fallarían contra el código de hoy.
  Sin ellos, «anda» solo significa que no explotó.
- Los marcados **`[compuerta]`** no se saltean: si uno no pasa, el trabajo se detiene ahí y
  se reporta, en lugar de seguir y acumular deuda.

---

## Fase 0 — Red de seguridad

> Antes de tocar una línea: poder volver atrás.

- [x] **F0-1 — `git init` y commit del estado heredado**
      Congelar las 6.968 líneas tal como están, sin arreglar nada. Punto de comparación de
      todo lo que sigue. → `c41e619`

## Fase 1 — Que instale y levante

> El proyecto nunca pasó por un `pnpm install`. Hasta que eso termine, nada se puede probar.

- [x] **F1-1 — Reconciliar dependencias contra los imports reales**
      Agregar los 8 paquetes que la API importa sin declarar (`@fastify/sensible`,
      `@sinclair/typebox`, `@fastify/type-provider-typebox`, `socket.io`, `redis`,
      `@socket.io/redis-adapter`, `pino`, `dotenv`) y sacar los 6 declarados que nadie
      usa. → `apps/api/package.json`
      *Verificado:* eran 8 y 6, no 7 y 5 — `dotenv` entra como side-effect import y el
      grep original no lo veía. Además `eslint-plugin-tailwindcss@^0.5.0` en
      `packages/config` no existía como versión; corregido a `^3.17.0`.
- [x] **F1-2 — `turbo.json`: `pipeline` → `tasks`**
      La clave es de Turborepo 1 y la raíz instala Turborepo 2. Sin esto ningún script del
      monorepo arranca. → `turbo.json`
- [x] **F1-3 — `pnpm install` termina y genera lockfile**
      Primera vez en la vida del proyecto. Deja `pnpm-lock.yaml`, que también se commitea.
      *Verificado:* 691 paquetes, 10m 32s, exit 0.
- [x] **F1-4 — Postgres y Redis arriba con healthcheck verde**
      `docker compose up -d`. El compose ya está bien escrito; solo sacarle la clave
      `version` que Compose v2 ignora. → `docker-compose.yml`
      *Verificado:* ambos `healthy` a los 6 s. Base limpia, 0 tablas.

## Fase 2 — Desbloquear el typecheck

> Recuperar el compilador como red de seguridad: hoy corta antes de revisar nada.

- [x] **F2-1 — Sacar los `declare module` de adentro de las funciones**
      Están dentro del cuerpo de `authPlugin()` y `familyPlugin()`, donde no son válidos.
      Mudarlos a un archivo de tipos propio devuelve `request.user`, `request.family` y
      `fastify.io` al chequeo de tipos. → `apps/api/src/types/fastify.d.ts` *(nuevo)*
- [x] **F2-2 — Correr typecheck y anotar la línea de base** `[compuerta]`
      Primera corrida real de `tsc` sobre la API. Lo que aparezca acá es el trabajo
      verdadero, no lo que se supuso leyendo.
      → `pnpm --filter @homehub/api typecheck`
      *Verificado:* la primera corrida dio 2 errores de configuración que abortaban `tsc`
      antes de revisar código (`references` a un `packages/shared/tsconfig.json`
      inexistente; `prisma/**` fuera del `rootDir`). Corregidos: el `tsconfig` de la API
      ahora extiende directo de la raíz sin `composite`, y `package.json` declara
      `"type": "module"` porque el código es ESM.
      **Línea de base real: 281 errores**, guardada en
      [`analysis/2026-09-12-tsc-baseline-api.txt`](../analysis/2026-09-12-tsc-baseline-api.txt).
      Se reducen a seis causas raíz:
      1. 113 — `packages/shared` re-exporta `z` sin importarlo. Una línea.
      2. ~30 — `httpErrors` sin `@fastify/sensible` registrado (F4-1).
      3. ~90 — rutas sin el type provider de TypeBox: `request.body` es `unknown`.
      4. 9 — `request.user` choca con la declaración de `@fastify/jwt` (F4-3).
      5. ~7 — `familyPrisma(request => …)`, el implicit any de B3. Fuera de alcance.
      6. 3 — `./shopping.js` inexistente; `import { crypto }` inválido; `any` en seed.

## Fase 2b — Cero errores fuera de auth

> Lo que la línea de base mostró y no es autenticación, pero bloquea el verde de F7-1.

- [x] **F2-3 — `import { z }` en `packages/shared`**
      Una línea. Elimina 113 de los 281 errores. → `packages/shared/src/index.ts`
- [x] **F2-4 — Type provider de TypeBox en cada router**
      Tipar los plugins de rutas con `FastifyPluginAsyncTypebox` para que los esquemas
      lleguen a `request.body` y `request.params`. Un cambio de firma por archivo.
      → `apps/api/src/routes/*.ts`
      *Verificado:* 119 → 28 errores. Con el type provider activo, TypeBox empezó a
      chequear también los schemas de respuesta, y eso trajo dos arreglos más:
      - Las fechas de las respuestas estaban declaradas como `Type.String()` y Prisma
        devuelve `Date`. Se agregó el helper `DateTime()` en `lib/schemas.ts`, que acepta
        los dos. En runtime no cambió nada: `/api/users/me` y `/api/family` siguen
        devolviendo ISO.
      - Los `where: Record<string, unknown>` pasan a `Prisma.<Modelo>WhereInput`, con
        filtros tipados para las fechas y los montos.
      Los 28 errores que quedan no son de este paso: 22 son de F2-7, 4 de `seed.ts` (F2-5)
      y 2 de F5-5.
- [x] **F2-5 — Imports y `any` sueltos**
      `import { crypto } from 'crypto'` no es un export válido; dos parámetros sin tipo
      en `seed.ts`. → `routes/invitations.ts`, `prisma/seed.ts`
      *Hecho:* `invitations.ts` usa `randomBytes` de `node:crypto`. En `seed.ts` el problema
      real no eran parámetros sin tipo sino los arrays de ejemplo: se inferían como `string`
      y Prisma espera sus enums. Ahora cada array usa `satisfies` con el
      `<Modelo>UncheckedCreateInput`, que además valida cada valor contra el enum.
      *Verificado:* `pnpm db:seed` corre y carga 2 usuarios, 5 gastos, 4 facturas, 5 todos,
      6 ítems de compra, 4 eventos y 6 asistencias. Después se borró la familia demo.
- [x] **F2-6 — Sacar el registro de `shoppingRoutes`**
      El módulo no existe y el servidor no puede levantar con el import roto. Escribirlo
      es trabajo de feature: se quita el registro con un `TODO` y queda para el bloque de
      supermercado. *(Hueco del plan original: F7-2 no podía pasar sin esto.)*
      → `apps/api/src/routes/index.ts`
- [x] **F2-7 — B3: `familyPrisma` recibe el id real, dentro de cada handler**
      Hoy se llama una vez al registrar el router, con una función en vez de un string.
      Además la extensión inyecta `where` en toda operación, incluido `create`, donde
      Prisma lo rechaza. Se reescribe para scopear lecturas, updates y deletes por
      `familyId` e inyectar `familyId` en `data` en los creates.
      → `plugins/family.ts`, `routes/{expenses,bills,todos,events,dashboard}.ts`
      *Hecho así:* el scoping aplica solo a los modelos con `familyId` propio (Expense, Bill,
      Todo, Event, ShoppingItem). Antes aplicaba a todos, incluido `Family`, donde agregar
      `familyId` al `where` rompía la consulta. Las rutas pasan `familyId` explícito en los
      `create` para que TypeScript lo acepte, y la extensión lo pisa igual con el de la
      sesión. En los `update`, un `familyId` en `data` también se pisa. El typecheck bajó
      de 28 a 6 errores: 4 de `seed.ts` (F2-5) y 2 de F5-5.
- [x] **F2-8 — Validar que `assigneeId` y `attendeeIds` sean de la misma familia**
      *Hueco encontrado en F2-7.* `todos` y `events` conectan usuarios por id sin comprobar
      a qué familia pertenecen, y el `include` devuelve el nombre y el avatar de ese
      usuario. Con el id de un usuario de otra familia se puede asignarlo y leer sus datos
      públicos. Hay que verificar los ids contra `request.family.id` antes del `connect`.
      → `routes/todos.ts`, `routes/events.ts`
      *Hecho:* `assertFamilyMembers` (`lib/members.ts`) cuenta los ids en la familia antes de
      cada `connect` o `set`. Responde 400 con un mensaje que no distingue "no existe" de "es
      de otra familia".
      *Verificado* contra el servidor real con dos familias:
      - Todo con assignee de B → 400; con un id inexistente → 400; con el propio → 201.
      - `PATCH` de un todo a un assignee de B → 400.
      - Evento con asistentes [A, B] → 400; con [A, A] → 201.
      - `PATCH` de un evento con asistentes [B] → 400.
      Los rechazados no dejaron nada escrito en la base.

## Fase 3 — Sesiones en la base

> Sin una tabla de refresh tokens no existe el logout: hoy el token sigue vivo siete días.

- [x] **F3-1 — Modelo `RefreshToken` en el schema**
      Guardar el hash del token —nunca el token plano—, su vencimiento, cuándo se revocó y
      cuál lo reemplazó, para poder detectar reúso. → `apps/api/prisma/schema.prisma`
- [x] **F3-2 — Aplicar el schema y regenerar el cliente**
      `prisma db push` + `prisma generate` contra el Postgres levantado en F1-4.
      *Verificado:* 10 tablas en `public`, `RefreshToken` con sus 7 columnas. Hizo falta
      crear `apps/api/.env` (ignorado por git) porque Prisma y `dotenv` leen del
      directorio de la app, no de la raíz; el `.env` de la raíz mezcla claves de las dos
      apps y usa `API_PORT` donde el código lee `PORT`.

## Fase 4 — Firmar los tokens de verdad

> El núcleo del problema. `@fastify/jwt` ya está registrado con el secreto correcto y nunca
> se usó.

- [x] **F4-1 — Registrar `@fastify/sensible`**
      Habilita los 30 usos de `fastify.httpErrors` que hoy tiran `TypeError` y devuelven 500
      donde debería haber un 401. → `apps/api/src/server.ts`
- [x] **F4-2 — Borrar el generador de tokens casero**
      Eliminar `generateAccessToken`, `generateRefreshToken` y `parseToken`. Son
      `JSON.stringify` + base64: es la vulnerabilidad entera en tres funciones.
      → `apps/api/src/plugins/auth.ts`
- [x] **F4-3 — Firmar y verificar con `@fastify/jwt`**
      Access de 15 minutos con `JWT_SECRET` y refresh de 7 días con `JWT_REFRESH_SECRET`, en
      namespaces separados. Las dos variables ya existen y el validador de entorno ya las
      exige. → `apps/api/src/server.ts`, `plugins/auth.ts`
- [x] **F4-4 — El `preHandler` verifica firma antes de tocar la base**
      Hoy decodifica y consulta Postgres con lo que venga. Debe rechazar en la verificación,
      antes de cualquier query. → `apps/api/src/plugins/auth.ts`
      *Recién empezó a aplicar con F4-5.* Antes estaba escrito pero no se ejecutaba.
- [x] **F4-5 — Sacar `authPlugin` y `familyPlugin` del encapsulamiento**
      Envolverlos con `fastify-plugin` (declararlo como dependencia) y eliminar el
      `decorateRequest('user')` duplicado. *(Hueco del plan original: viene del código
      heredado y ningún typecheck lo detecta.)* → `plugins/auth.ts`, `plugins/family.ts`
      *Verificado con `inject`:* se armó una instancia con los mismos plugins y una ruta
      registrada como hermana, igual que en `registerRoutes`. Sin token → 401; token base64
      fabricado → 401; firmado con otro secreto → 401; token válido → 200, con
      `request.user`, `request.family` y `hashPassword` visibles desde la ruta. Todavía no
      se probó con el servidor completo (ver F7-2).

## Fase 5 — Rutas sobre cookies httpOnly

> Una sola fuente de verdad: el token nunca vuelve en el cuerpo de la respuesta ni toca
> JavaScript.

*F4-1 a F4-3 y F5 están escritos y `routes/auth.ts` + `plugins/auth.ts` compilan sin
errores. No corrieron todavía: los verifica la Fase 7.*

- [x] **F5-1 — `register` y `login` emiten solo cookies**
      Sacar `accessToken` y `refreshToken` del body de respuesta y del esquema de OpenAPI. Si
      el token no viaja en el JSON, el frontend no puede guardarlo en `localStorage` aunque
      quiera. → `apps/api/src/routes/auth.ts`
- [x] **F5-2 — `refresh` valida contra la tabla y rota**
      Verificar firma, buscar el hash en la base, comprobar que no esté revocado ni vencido,
      emitir el par nuevo y revocar el anterior encadenándolo.
- [x] **F5-3 — `logout` revoca en la base**
      Hoy solo borra la cookie del navegador. Tiene que marcar el refresh token como revocado
      para que cerrar sesión signifique algo del lado del servidor.
- [x] **F5-4 — Reúso de un refresh revocado mata la cadena**
      Si llega un token ya rotado es señal de robo: revocar todas las sesiones descendientes
      de ese usuario.

- [x] **F5-5 — `invitations/accept` emite la sesión como `register`**
      *Hueco encontrado en F2-4.* La ruta todavía llama a `generateAccessToken` y
      `generateRefreshToken`, que F4-2 borró: hoy tira `TypeError` y responde 500. Además
      devuelve los tokens en el body (va contra `decisions/0001`), no guarda el refresh en
      la tabla y, si el email ya existe, cambia de familia a ese usuario sin pedirle la
      contraseña.
      *Decidido el 2026-09-27:* si el email ya tiene cuenta, la invitación se rechaza con
      409. La persona inicia sesión y la acepta desde adentro, así que mover a alguien de
      familia requiere una sesión suya.
      *Hecho:* `issueSession` pasó a `lib/tokens.ts` y es la única forma de abrir sesión.
      `accept` crea el usuario y reclama la invitación dentro de una transacción, emite la
      sesión solo en cookies y responde 409 si el email ya tiene cuenta.
      *Verificado* contra el servidor real:
      - Email nuevo → 200, dos cookies `httpOnly`, sin tokens en el body. `me` devuelve
        MEMBER de la familia que invitó, con una fila en `RefreshToken`.
      - El mismo token otra vez → 409.
      - Email con cuenta → 409, y la cuenta sigue en su familia.
      - Dos `accept` en paralelo con el mismo token → un 200 y un 409, y se crea un solo
        usuario.
      *Pendiente, fuera de este paso:* aceptar la invitación con la sesión iniciada no
      existe todavía. Tiene decisiones de producto propias; por ejemplo, qué pasa si la
      persona es la única admin de su familia actual.
      → `routes/invitations.ts`, `routes/auth.ts` (`issueSession` pasa a `lib/tokens.ts`)

## Fase 6 — Cerrar el WebSocket

> El canal de tiempo real tiene su propia copia del parser inseguro.

- [ ] **F6-1 — Borrar el `parseToken` duplicado del socket**
      Reemplazarlo por la verificación real de JWT leyendo la cookie del handshake. Con el
      parser viejo, un token inventado entra al room de cualquier familia.
      → `apps/api/src/socket/index.ts`

## Fase 7 — Verificación

> La parte que nunca se hizo. Un paso no está listo porque se escribió: está listo porque
> corrió.

- [x] **F7-1 — `typecheck` verde en `apps/api`** `[compuerta]`
      Cero errores. No «los que quedan son de tipos nomás».
      *Verificado el 2026-09-27:* `pnpm --filter @homehub/api typecheck` → exit 0. La línea
      de base era de 281 errores.
- [x] **F7-2 — El servidor levanta y documenta** `[compuerta]`
      `/health` responde 200 y `/docs` muestra el OpenAPI con las rutas registradas.
      *Dos bloqueos heredados, encontrados al verificar F4-5 y ya resueltos:*
      1. `server.ts` solo llamaba a `start()` si `` import.meta.url === `file://${process.argv[1]}` ``.
         La ruta del repo tiene un espacio (`Carrear Path`), la URL lo codifica como `%20`
         y la comparación nunca daba igual: el proceso terminaba sin levantar nada y sin
         error. Ahora compara contra `pathToFileURL(process.argv[1]).href`.
      2. `io` se decoraba dos veces, en `socket/index.ts` y en `server.ts`, y el arranque
         tiraba `FST_ERR_DEC_ALREADY_PRESENT`. Queda solo el de `server.ts`.
      *Verificado* con `tsx src/server.ts` contra Postgres y Redis locales: `/health` → 200;
      `/docs/json` → 200 con 32 rutas; `GET /api/todos` sin token → 401; token base64
      fabricado en `/api/auth/me` → 401.

- [x] **F7-3 — Flujo completo con curl contra Postgres real** `[compuerta]`
      `register` → `me` devuelve 200 → `refresh` entrega un par nuevo → `logout` → `me` ahora
      devuelve 401. Con cookies, sin tocar el body.
      *Verificado el 2026-09-27:* register 201 → `me` 200 → refresh 200 con par nuevo →
      `me` 200 → logout 200 → `me` 401. El refresh reenviado a mano después del logout da
      401 (revocado en la base). Login 200, login con clave mala 401. Ninguna respuesta
      trae tokens en el body.
      **Consecuencia conocida, a decidir:** el access token reenviado a mano después del
      logout sigue dando 200 hasta que vence (15 min). Es el costo de verificar solo la
      firma, sin consultar la base; `decisions/0001` no lo menciona. Las opciones son
      aceptar esa ventana y documentarla, o agregar un chequeo de sesión en el `preHandler`
      (por ejemplo, un `sid` en el access token que apunte a la fila de `RefreshToken`).
- [x] **F7-4 — Un token fabricado a mano devuelve 401** `[discriminador]`
      Generar el token base64 del análisis con `role: ADMIN` y mandarlo. Hoy devuelve 200 y
      entrega la sesión. Si este paso no pasa, nada de lo anterior sirvió.
      *Verificado:* el token base64 con `role: ADMIN` da 401 como header `Bearer` y como
      cookie. También dan 401 el payload real con `alg: none` sin firma y el payload real
      con la firma recortada. Control: el token original da 200.
- [x] **F7-5 — Un refresh token ya usado devuelve 401** `[discriminador]`
      Rotar una vez y reintentar con el token viejo. Hoy funcionaría indefinidamente porque
      no hay estado del lado del servidor.
      *Verificado:* rotar da 200 y reusar el viejo da 401. Después del reuso, el refresh
      nuevo también da 401: el reuso revoca todas las sesiones del usuario (F5-4).
- [x] **F7-6 — Un token firmado con otro secreto devuelve 401** `[discriminador]`
      Confirma que la verificación mira la firma y no solo la forma del payload.
      *Verificado* con el mismo payload (usuario real) y solo la firma cambiada: con
      `JWT_SECRET` da 200 (control); con otro secreto, 401; con `JWT_REFRESH_SECRET`, 401.
      Un refresh usado como access da 401, y un access usado como refresh también.
- [x] **F7-7 — Una familia no ve los datos de otra** `[discriminador]`
      Registrar dos familias. A crea un gasto; B lo pide por id y recibe 404. Hoy el
      scoping no funciona en ningún momento, así que B lo vería —si la ruta no
      explotara antes.
      *Verificado* contra el servidor real con dos familias registradas. A crea un gasto y
      lo lee: 200. B lo lee: 404. B lo modifica: 404. B lo borra: 404. B lista gastos:
      total 0. B crea un gasto mandando `familyId` de A: queda en la familia de B (lo
      confirmó la base) y el de A sigue intacto. El dashboard y las listas de A responden
      200. Los datos de prueba se borraron después.

## Fase 8 — Consolidar

- [ ] **F8-1 — Un commit por fase verde**
      Historial legible en vez de un único commit gigante: cada mensaje dice qué se arregló y
      contra qué se verificó.
- [ ] **F8-2 — Escribir `flows/auth.md`**
      El flujo de autenticación ya verificado, siguiendo la plantilla de
      [`flows/README.md`](../flows/README.md). Recién acá, con todo funcionando: documentar
      antes produce ficción.

---

## Fuera de alcance

- ~~B3, el aislamiento entre familias~~ — *entró al bloque el 2026-09-12 (F2-7, F7-7).*
- El módulo de supermercado (`routes/shopping.ts`): se quita el registro en F2-6 y se
  escribe en su propio bloque.
- Todo el frontend: C1 a C5 quedan para el bloque 3.
- `PATCH /api/todos/:id` borra `dueDate` si el body no lo trae: calcula
  `request.body.dueDate ? new Date(...) : null` y no distingue "no vino" de `null`.
  Encontrado en F2-8.

## Entorno verificado

| Herramienta | Versión | Cómo |
|---|---|---|
| Node | 22.12.0 | `nvm use 22` |
| pnpm | 9.15.2 | viene con esa versión de Node |
| Docker | 29.7.2 | daemon respondiendo |
| Docker Compose | v5.4.0 | |
| git | 2.43.0 | |

`node` y `pnpm` no están en el `PATH` por defecto del shell no interactivo: hay que cargar
nvm primero.
