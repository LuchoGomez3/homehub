# Flujo: autenticación y sesión

- **Última verificación:** 2026-09-27, contra el entorno local (`docker compose` con Postgres
  y Redis, API con `tsx src/server.ts`). Detalle en
  [`plans/auth-hardening.md`](../plans/auth-hardening.md), fase 7.
- **Código:** `apps/api/src/routes/auth.ts`, `routes/invitations.ts` (`/accept`),
  `plugins/auth.ts`, `plugins/family.ts`, `lib/tokens.ts`, `lib/session.ts`, `lib/rooms.ts`,
  `socket/index.ts`
- **Decisión de base:** [`decisions/0001`](../decisions/0001-sesion-en-cookies-httponly.md),
  sesión en cookies `httpOnly` emitidas por la API.

## Disparador

Hay cuatro formas de obtener una sesión, y todas terminan en `issueSession`
(`lib/tokens.ts`):

| Ruta | Quién | Qué hace además |
|---|---|---|
| `POST /api/auth/register` | cualquiera | crea una familia nueva y al usuario como `ADMIN` |
| `POST /api/auth/login` | quien tenga cuenta | — |
| `POST /api/invitations/accept` | quien tenga el token de una invitación **y no tenga cuenta** | crea al usuario en la familia que invitó, con el rol de la invitación |
| `POST /api/auth/refresh` | quien tenga un refresh válido | rota la sesión: revoca la anterior y emite una nueva |

Las sesiones se cierran con `POST /api/auth/logout`, o al detectarse el reuso de un
refresh.

## Recorrido

### 1. Emitir una sesión (`issueSession`)

1. Se genera un id de sesión (`randomUUID`).
2. Con ese id se firman dos JWT:
   - **access**: 15 minutos, firmado con `JWT_SECRET`. Payload:
     `{ sub, familyId, role, type: 'access', sid }`.
   - **refresh**: 7 días, firmado con `JWT_REFRESH_SECRET`. Payload:
     `{ sub, familyId, role, type: 'refresh', jti }`.

   `sid` y `jti` son el mismo valor: el id de la fila en `RefreshToken`.
3. Se guarda la fila de `RefreshToken`, con `id` igual al id de sesión y el **hash SHA-256**
   del refresh; el token plano nunca se guarda. Si es una rotación, la fila anterior queda
   revocada y apunta a la nueva con `replacedById`.
4. Los dos tokens salen **solo como cookies** `httpOnly`, `SameSite=Lax` y `Secure` en
   producción:
   - `accessToken`, con `path: /`.
   - `refreshToken`, con `path: /api/auth`, para que no viaje en cada request.

   El body de la respuesta trae solo `{ user }`.

### 2. Autenticar una request HTTP (`plugins/auth.ts`)

1. Si la ruta está en `PUBLIC_PREFIXES` (`/health`, `/docs`, `login`, `register`,
   `refresh`, `logout`, `invitations/accept`), pasa sin chequeo.
2. El token se toma del header `Authorization: Bearer`, y si no hay, de la cookie
   `accessToken`.
3. `verifyAccessSession` (`lib/session.ts`):
   1. Verifica la firma y el vencimiento con `JWT_SECRET`, **antes de tocar la base**.
   2. Exige `type: 'access'` y un `sid`.
   3. En una sola consulta, busca la fila de sesión con su usuario. Rechaza si no existe,
      si está revocada o si `sub` o `familyId` no coinciden con el usuario.
4. Queda `request.user`. Después, `plugins/family.ts` carga `request.family`.

Los dos plugins están envueltos en `fastify-plugin`. Sin eso, Fastify encapsula sus hooks
y **no se aplican a las rutas**.

### 3. Rotar (`POST /api/auth/refresh`)

1. Verifica la firma del refresh con `JWT_REFRESH_SECRET` y exige `type: 'refresh'`.
2. Busca la fila por hash:
   - Si no existe, 401.
   - Si está revocada, es un **reuso**: se revocan todas las sesiones del usuario y se
     desconectan sus sockets.
   - Si venció, 401.
3. Emite una sesión nueva encadenada a la anterior. Los sockets abiertos pasan a la sala
   de la sesión nueva, sin desconectarse.

### 4. Cerrar sesión (`POST /api/auth/logout`)

1. Busca la fila por el hash del refresh de la cookie, sin verificar la firma.
2. Si está viva, la revoca. En cualquier caso desconecta los sockets de esa sesión.
3. Borra las dos cookies. Es idempotente: sin cookie, o con una que no coincide con
   ninguna fila, igual responde 200.

### 5. WebSocket (`socket/index.ts`)

1. Socket.IO comparte el servidor HTTP de Fastify.
2. El handshake toma el token de `auth.token`, del header `Authorization` o de la cookie
   `accessToken`, y lo pasa por **el mismo** `verifyAccessSession`.
3. El socket entra a tres salas: `family:<familyId>` (eventos de la familia),
   `user:<id>` y `session:<sid>`. Las dos últimas son las que se vacían al revocar.

## Estado resultante

- **`RefreshToken`**: una fila por sesión, con `id` igual al id de sesión, `tokenHash`,
  `expiresAt`, `revokedAt` y `replacedById`. Cada rotación agrega una fila y revoca la
  anterior, así que las filas forman una cadena.
- **Navegador**: dos cookies `httpOnly`. JavaScript no puede leer ningún token.
- **Redis**: las salas de Socket.IO, compartidas entre instancias por el adapter.

## Casos de error

Todos los 401 salen con el formato de `@fastify/sensible`:
`{ statusCode, error, message }`.

| Situación | Respuesta | Estado del sistema |
|---|---|---|
| Request protegida sin token | 401 `Authentication required` | — |
| Token fabricado, firma recortada, `alg: none` u otro secreto | 401 `Invalid or expired session` | no se consulta la base |
| Refresh token usado como access, o al revés | 401 | — |
| Access de una sesión revocada (logout, rotación, reuso) | 401 `Invalid or expired session` | — |
| Login con credenciales malas | 401 `Invalid credentials`, el mismo para email inexistente y clave incorrecta | — |
| Register con email existente | 409 `Email already registered` | — |
| Refresh sin cookie | 401 `Refresh token required` | — |
| Refresh reusado | 401 `Refresh token reuse detected` | **todas** las sesiones del usuario revocadas, sus sockets desconectados y las cookies borradas |
| Accept con token inexistente | 404 `Invalid invitation` | — |
| Accept de una invitación ya aceptada | 409 `Invitation already accepted` | — |
| Accept de una invitación vencida | 410 `Invitation expired` | — |
| Accept con un email que ya tiene cuenta | 409 `Account already exists. Log in to accept this invitation.` | la cuenta sigue en su familia |
| Dos accept simultáneos con el mismo token | uno 200, el otro 409 | un solo usuario creado |
| Handshake de socket sin sesión válida | `connect_error` | — |

## Reglas de negocio

- **Los tokens nunca van en el body de una respuesta** (`decisions/0001`). Si aparece uno,
  es un bug.
- **Revocar una sesión corta el acceso en el momento**: la request HTTP siguiente y el
  socket abierto. No hay una ventana de 15 minutos. Decidido el 2026-09-27 (F5-6).
- **Durante una rotación, una request que salga con el access viejo recibe 401.** El
  cliente tiene que reintentarla una vez después del refresh.
- **Una invitación no mueve una cuenta existente a otra familia.** El token de invitación
  no prueba quién es el dueño del email. Decidido el 2026-09-27 (F5-5). Aceptar una
  invitación con la sesión iniciada **todavía no existe**.
- **Reusar un refresh se trata como robo**: se revocan todas las sesiones del usuario, no
  solo la cadena del token reusado.
- **Los dos secretos son distintos a propósito.** Con uno solo, un refresh serviría como
  access. `type` en el payload es una segunda barrera.
- **Toda consulta de datos de familia pasa por `familyPrisma(request.family.id)`.** El
  `familyId` sale de la sesión, nunca del cliente.

## Cómo verificarlo

Con Postgres y Redis arriba (`docker compose up -d`) y la API levantada. Los comandos
dan por hecho el puerto 3001.

```bash
B=localhost:3001; C=$(mktemp); J='content-type: application/json'
ck() { awk -v n="$1" '$6==n{print $7}' "$C" | tail -1; }
code() { curl -s -o /dev/null -w '%{http_code}\n' "$@"; }

# Flujo completo: 201, 200, 200, 200, 401
code -c $C -H "$J" -d '{"email":"prueba@test.dev","password":"supersecret1","name":"P"}' $B/api/auth/register
code -b $C $B/api/auth/me
code -b $C -c $C -X POST $B/api/auth/refresh
A=$(ck accessToken)
code -b $C -c $C -X POST $B/api/auth/logout
code -b $C $B/api/auth/me

# Discriminador: el access de la sesión cerrada, reenviado a mano → 401.
# Antes de F5-6 daba 200.
code -H "Authorization: Bearer $A" $B/api/auth/me

# Discriminador: token base64 sin firma con role ADMIN → 401.
# Con el código heredado daba 200.
FAKE=$(printf '{"sub":"x","familyId":"y","role":"ADMIN","type":"access","exp":9999999999}' \
  | base64 -w0 | tr '+/' '-_' | tr -d '=')
code -H "Authorization: Bearer $FAKE" $B/api/auth/me
```

Para el refresh reusado: guardá la cookie `refreshToken`, rotá una vez y mandá la vieja a
`/api/auth/refresh`. Tiene que dar 401, y a partir de ahí también el refresh nuevo.

Para el socket: con `socket.io-client`, un handshake sin cookie o con `$FAKE` en
`auth.token` recibe `connect_error`. Con la cookie `accessToken` conecta, y el `logout`
de esa sesión lo desconecta con motivo `io server disconnect`.

Los datos de prueba se borran con la familia, porque los usuarios y las sesiones caen
en cascada:
`DELETE FROM "Family" WHERE id IN (SELECT "familyId" FROM "User" WHERE email LIKE '%@test.dev');`
