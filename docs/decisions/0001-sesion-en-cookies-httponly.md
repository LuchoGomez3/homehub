# 0001 — La sesión vive en cookies httpOnly emitidas por la API

- **Fecha:** 2026-09-12
- **Estado:** Aceptada
- **Afecta a:** `apps/api` (auth), `apps/web` (cliente y middleware)

## Contexto

El código heredado tenía **tres sistemas de sesión funcionando en paralelo**, ninguno con
autoridad sobre los otros:

1. La API Fastify emitía `accessToken` y `refreshToken` como cookies `httpOnly`.
2. NextAuth mantenía su propia sesión JWT, firmada con un secreto distinto
   (`NEXTAUTH_SECRET`).
3. El store de Zustand persistía los dos tokens en `localStorage`, y el cliente HTTP los
   leía de ahí para armar el header `Authorization`.

Tres fuentes de verdad que podían desincronizarse, y la más débil —`localStorage`, legible
por cualquier script de la página— era la que terminaba usándose. Guardar un token en
`localStorage` anula exactamente la protección que las cookies `httpOnly` venían a dar.

Aparte de eso, los tokens no estaban firmados (ver
[`analysis/2026-09-12-estado-inicial.md`](../analysis/2026-09-12-estado-inicial.md), hallazgo B1),
pero ese es un problema distinto: arreglar la firma sin resolver antes cuál es la fuente de
verdad habría dejado tres sistemas seguros peleándose en lugar de tres inseguros.

## Opciones consideradas

**A. Cookies `httpOnly` emitidas por la API.** La API es la única autoridad. El frontend
nunca ve un token. Se elimina NextAuth y los tokens salen del store.

**B. NextAuth como capa de sesión del frontend**, guardando adentro el token de la API.
Conserva el código de NextAuth ya escrito y deja OAuth social casi gratis más adelante. A
cambio quedan dos sistemas de tokens con dos secretos y dos expiraciones que hay que
mantener sincronizadas.

**C. Bearer en memoria + refresh en cookie.** El access token vive en una variable de JS,
nunca en disco. Patrón habitual de SPA. Obliga a una pantalla de carga en cada arranque,
porque al recargar la página la sesión no existe hasta que completa el refresh.

## Decisión

**Opción A.**

- La API emite `accessToken` (15 min) y `refreshToken` (7 días) como cookies `httpOnly`,
  `SameSite=Lax`, y `Secure` en producción.
- Los tokens **no viajan en el cuerpo de ninguna respuesta** ni aparecen en el esquema de
  OpenAPI. Si el token no está en el JSON, el frontend no puede guardarlo en `localStorage`
  aunque quiera: la decisión queda forzada por el diseño, no por disciplina.
- Se elimina NextAuth por completo: `lib/auth.ts`, la ruta `[...nextauth]` y `NEXTAUTH_SECRET`.
- El store de Zustand conserva los datos del usuario para la interfaz, pero ningún token.
- Los `rewrites` que ya están en `next.config.ts` hacen que la API se vea como mismo origen
  desde el navegador, así que las cookies viajan sin configuración de CORS adicional.

## Consecuencias

- Un solo secreto para la sesión de acceso y un solo lugar donde revocarla.
- Ningún token accesible desde JavaScript: un XSS deja de ser robo de sesión inmediato.
- Login con Google o GitHub, si algún día se quiere, se implementa en Fastify. No sale
  gratis como salía con NextAuth. Es el costo aceptado de esta decisión.
- El frontend necesita manejar el 401 llamando a `/api/auth/refresh` y reintentando, en
  lugar de leer la expiración del token —que ya no puede ver.
- Queda una dependencia operativa: al usar cookies, la API y la web tienen que compartir
  origen (vía los rewrites) o configurarse explícitamente para cross-site. En desarrollo
  los rewrites ya lo resuelven.
