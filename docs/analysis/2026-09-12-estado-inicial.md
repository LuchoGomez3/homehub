# Estado inicial del código heredado

- **Fecha:** 2026-09-12
- **Alcance:** 58 archivos de código, 4 workspaces, ~6.968 líneas
- **Método:** auditoría estática. Nada de esto se ejecutó, porque no se puede.
- **Commit auditado:** `c41e619` (estado heredado, sin modificar)

> Este documento es una foto fechada. No se edita. Si la realidad cambia, se escribe un
> análisis nuevo.

## Resumen

Hay 6.968 líneas de TypeScript en el monorepo y **ninguna llegó a ejecutarse nunca**. No
existe `pnpm-lock.yaml` ni `node_modules` en ningún workspace: el proyecto jamás pasó por
un `pnpm install`.

El diseño de datos y los contratos compartidos son buenos y se rescatan casi enteros. La
capa de autenticación hay que tirarla: los tokens no están firmados.

| Medida | Valor |
|---|---|
| Líneas escritas | 6.968 |
| Líneas ejecutadas alguna vez | 0 |
| Imports sin dependencia declarada | 15 |
| Dependencias declaradas que nadie usa | 11 |
| Commits antes de esta auditoría | 0 |

---

## A · Por qué no arranca

Nueve bloqueantes. Cada uno, por sí solo, impide que el proceso llegue a escuchar en un
puerto.

### A1 — Se importa un archivo que no existe

`apps/api/src/routes/index.ts:7` importa `./shopping.js` y registra `shoppingRoutes` en
`/api/shopping`, pero `apps/api/src/routes/shopping.ts` no fue escrito nunca.

El módulo de supermercado existe en el schema de Prisma, en el seed, en el cliente del
frontend y en el dashboard. Falta solo el router. Node muere en el import antes de evaluar
nada.

### A2 — 15 paquetes importados que no están en ningún `package.json`

**Faltan en `apps/api`:** `@sinclair/typebox`, `@fastify/type-provider-typebox`,
`socket.io`, `redis`, `@socket.io/redis-adapter`, `pino`, `@fastify/sensible`.

**Faltan en `apps/web`:** `next-auth`, `next-themes`, `class-variance-authority`,
`@tanstack/react-query-devtools`, `@radix-ui/react-avatar`, `@radix-ui/react-dropdown-menu`,
`@radix-ui/react-toast`, `@radix-ui/react-tooltip`.

**Declaradas y nunca usadas:** los cinco paquetes de `fullcalendar`, `recharts`, `ioredis`,
`@fastify/socket.io`, `@fastify/static`, `fastify-type-provider-zod`, `date-fns-tz`.

Los manifests se escribieron de memoria, sin contrastarlos contra el código.

### A3 — `fastify.httpErrors` se usa 30 veces y no existe

Ese decorador lo aporta `@fastify/sensible`, que no está instalado ni registrado. Cada
rechazo de autenticación, cada 403 y cada 404 termina en
`TypeError: Cannot read properties of undefined` y cae al handler genérico como un 500.

El caso de error nunca se probó.

### A4 — `declare module` dentro del cuerpo de una función

En `apps/api/src/plugins/auth.ts:98` y `apps/api/src/plugins/family.ts:42`, las ampliaciones
de tipos de Fastify están escritas adentro de `authPlugin()` y `familyPlugin()`. Una
declaración de módulo solo es válida en el nivel superior del archivo.

`tsc` corta ahí, y como efecto colateral ninguna de las propiedades declaradas
(`request.user`, `request.family`, `fastify.io`) existe para el chequeo de tipos del resto
de la API.

### A5 — `turbo.json` está escrito para Turborepo 1

Usa la clave `"pipeline"`, que Turborepo 2 renombró a `"tasks"`. La raíz instala
`turbo@^2.0.0`, así que `pnpm run dev` aborta antes de delegar en ningún workspace.

### A6 — Tailwind sin `postcss.config.js`

Hay `tailwind.config.ts` y un `globals.css` con las directivas, pero falta el archivo de
PostCSS que le dice a Next que procese Tailwind. La app se serviría completamente sin
estilos.

### A7 — `next.config.ts` exporta con `module.exports`

El archivo es TypeScript pero termina en `module.exports = nextConfig` en lugar de
`export default`. Se pierden `transpilePackages` —imprescindible acá, porque
`@homehub/shared` y `@homehub/ui` se publican como TypeScript sin compilar— y los
`rewrites` hacia la API.

### A8 — `@homehub/config` es un paquete vacío

Los cuatro workspaces lo declaran como dependencia y su `package.json` publica `eslint`,
`typescript` y `prettier`, pero el directorio contiene solo ese `package.json`.

No hay ningún `.eslintrc` en todo el monorepo, así que `pnpm run lint` falla en los cuatro.
Tampoco hay un solo test, y `vitest run` sin archivos sale con código distinto de cero: los
tres scripts de verificación de `turbo.json` están rotos.

### A9 — El trabajo no estaba versionado

La carpeta no era un repositorio git. Había un `.gitignore` correcto —incluso ignora
`.env`— esperando un `git init` que nunca ocurrió.

*(Resuelto el 2026-09-12 con el commit `c41e619`.)*

---

## B · Autenticación y aislamiento

Esta es la parte que no se parchea. Si el resto del proyecto estuviera perfecto, estos seis
puntos igual obligarían a rehacer la capa de sesión desde cero.

### B1 — Los tokens no están firmados: son JSON en base64

`apps/api/src/plugins/auth.ts:18-46`. `generateAccessToken` serializa un objeto y lo
codifica en base64url. `parseToken` lo decodifica y solo mira que `exp` no haya vencido.

No hay firma, no hay HMAC, no hay verificación de ningún tipo. Cualquiera con un navegador
se fabrica una sesión de administrador de cualquier familia:

```js
node -e "console.log(Buffer.from(JSON.stringify({
  sub:      '<cualquier-user-id>',
  familyId: '<cualquier-family-id>',
  role:     'ADMIN',
  type:     'access',
  exp:      9999999999
})).toString('base64url'))"

// pegar el resultado en la cookie accessToken → admin de esa familia
```

El único chequeo posterior es que el `familyId` del token coincida con el del usuario en la
base, y eso se satisface eligiendo un par válido cualquiera. El login, el refresh y el canal
de WebSocket aceptan todos el mismo token falsificado.

### B2 — `@fastify/jwt` está registrado con el secreto y nunca se usa

`apps/api/src/server.ts:68-76` registra el plugin de JWT con `env.JWT_SECRET`, expiración de
15 minutos y lectura desde cookie: toda la configuración correcta. Después ninguna línea del
proyecto llama a `sign` ni a `verify`.

La infraestructura segura está montada al lado de la insegura, sin conectarse. Lo mismo pasa
con `JWT_REFRESH_SECRET` y `COOKIE_SECRET`, ambos exigidos por el validador de entorno y
nunca usados.

### B3 — El aislamiento entre familias recibe una función donde espera un string

`familyPrisma(familyId: string)` (en `plugins/family.ts:24`) devuelve un cliente Prisma
extendido que inyecta `familyId` en el `where` de toda consulta. Las cinco rutas que lo usan
—`expenses.ts:67`, `bills.ts:66`, `todos.ts:65`, `events.ts:66`, `dashboard.ts:6`— lo
invocan así:

```ts
const familyPrisma = fastify.familyPrisma(request => request.family!.id);
//                                        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
// una función, no un id — y evaluada una sola vez al registrar el plugin,
// no por request: no hay ningún `request` en ese scope
```

Prisma termina recibiendo `where: { familyId: [Function] }` en cada consulta. Todo el módulo
de gastos, facturas, tareas, eventos y el dashboard falla en runtime, y el mecanismo pensado
para que una familia no vea los datos de otra no cumple esa función en ningún momento.

Las rutas `GET/PATCH/DELETE /:id` buscan por id solo, así que apenas se arregle el crash
queda un acceso directo a recursos ajenos si el scoping no se rehace bien.

### B4 — El WebSocket reimplementa el mismo parser inseguro

`apps/api/src/socket/index.ts:86-96` tiene una copia literal de `parseToken`, con el
comentario *«same logic as auth plugin»*. Un token fabricado a mano entra al room
`family:<id>` de cualquier familia y recibe en vivo cada gasto, factura, tarea y evento que
se cree o modifique.

### B5 — Tres sistemas de sesión en paralelo, ninguno con autoridad

La API emite cookies `httpOnly`. NextAuth mantiene su propia sesión JWT con un secreto
distinto. Y `stores/auth.ts` persiste `accessToken` y `refreshToken` en `localStorage` vía
Zustand —exactamente lo que las cookies `httpOnly` venían a evitar— mientras `lib/api.ts`
los lee de ahí para armar el header `Authorization`.

Tres fuentes de verdad que pueden desincronizarse, y la más débil gana.

*(Resuelto por [`decisions/0001`](../decisions/0001-sesion-en-cookies-httponly.md).)*

### B6 — Los refresh tokens no se pueden revocar

El schema de Prisma no tiene modelo de sesión ni de refresh token. `POST /api/auth/logout`
borra las cookies del navegador y nada más: el token sigue siendo válido siete días del lado
del servidor.

No hay forma de cerrar sesión en otro dispositivo, ni de invalidar nada ante un robo de
credenciales.

---

## C · Frontend

Independientes de los anteriores: aun con la API sana y las dependencias instaladas, ninguna
pantalla llegaría a mostrar datos.

### C1 — El cliente HTTP duplica su propia URL base

`apps/web/src/lib/api.ts:150-162`. Al final del archivo se reemplaza
`ApiClient.prototype.request` para manejar query params. El reemplazo construye una URL
absoluta y se la pasa al método original, que vuelve a concatenarle `this.baseUrl`.

El destino que sale a la red es `http://localhost:3001http://localhost:3001/api/...`.

### C2 — Los filtros y la paginación se descartan en silencio

Diecisiete métodos pasan `{ params: filters }` como segundo argumento de `fetch`.
`RequestInit` no tiene una propiedad `params`: el objeto se ignora sin error. Categorías,
rangos de fecha, montos, orden y paginación nunca viajan al servidor.

Hay una función `buildQuery` correcta escrita en la línea 139 que nadie llama.

### C3 — El middleware redirige al login en bucle

`apps/web/src/middleware.ts:9-23`. Las rutas públicas se comparan contra `/login` y
`/register`, pero las páginas reales viven bajo el segmento de idioma: `/es/login`.
`startsWith('/login')` nunca da verdadero, así que el propio destino de la redirección se
considera protegido y vuelve a redirigirse a sí mismo.

### C4 — next-intl sin su middleware

Hay `[locale]` en el router, `i18n/request.ts` y 246 líneas de traducciones en español e
inglés, pero el único middleware exportado es el de NextAuth. Sin el de next-intl no hay
negociación de idioma ni resolución del segmento: el locale queda escrito a mano como
`/es/...` en cada redirect.

### C5 — Los tipos del cliente no coinciden con lo que responde la API

La API envuelve todo en `{ success, data }`. Los métodos de `lib/api.ts` están tipados como
si devolvieran el recurso directo, y después `lib/auth.ts` accede a `response.data`, un campo
que el tipo declarado no tiene.

Como nunca se ejecutó `tsc`, la contradicción pasó desapercibida. El sobre `ApiResponse<T>`
ya está definido en `@homehub/shared`, listo para usarse en ambos lados.

---

## D · Qué se rescata

Se conserva lo que expresa decisiones de diseño —qué datos existen, cómo se relacionan, qué
forma tiene un gasto válido— y se descarta lo que intenta ejecutar esas decisiones, porque es
justo donde está el daño.

| Pieza | Líneas | Veredicto | Por qué |
|---|---|---|---|
| `packages/shared/src/index.ts` | 573 | **Conservar** | Lo mejor del proyecto. Enums, 24 esquemas Zod, tipos derivados por inferencia, helpers de respuesta y el mapa de eventos de WebSocket. Coherente y sin dependencias de lo roto. |
| `prisma/schema.prisma` | 222 | **Conservar** | `Decimal(10,2)` para dinero, índices compuestos por `familyId`, cascadas explícitas, `SetNull` donde corresponde. Solo falta el modelo de sesión (B6). |
| `docker-compose.yml` | 58 | **Conservar** | Postgres 16 y Redis 7 con healthchecks reales y Adminer detrás de un profile. Sacar la clave `version`, que Compose v2 ignora. |
| `messages/es.json` · `en.json` | 492 | **Conservar** | Las dos traducciones completas y en paralelo. Trabajo tedioso ya hecho. |
| Estructura del monorepo | — | **Conservar** | La separación apps/packages y la elección del stack son correctas. El problema nunca fue la arquitectura. |
| `packages/ui` | ~450 | **Revisar** | Siete componentes genéricos utilizables, pero conviven con otros seis duplicados en `apps/web/src/components/ui`. Elegir un solo lugar. |
| Rutas de la API | ~1.400 | **Rehacer sobre el diseño** | La forma es buena: paginación, filtros, esquemas TypeBox, emisión por WebSocket en cada mutación. Pero todas dependen de `familyPrisma` (B3) y `httpErrors` (A3). |
| Capa de autenticación | ~560 | **Descartar** | Plugin de auth, rutas de auth, `lib/auth.ts`, el store de Zustand y el middleware. Todo B1–B6 vive acá. |
| `lib/api.ts` | 161 | **Descartar** | El inventario de endpoints sirve como referencia, pero el mecanismo (C1, C2) se reescribe. Un cliente generado desde el OpenAPI elimina la clase entera. |
| Dashboard y componentes | ~700 | **Descartar** | Construidos contra un cliente HTTP que no funciona y un contrato equivocado. |

---

## E · Sobre las herramientas

Se evaluaron nueve plugins sugeridos para el desarrollo, contrastados contra los 123 del
marketplace oficial de Anthropic. Cuatro no existen ahí: `canvas-design`, `ui-ux-pro-max`,
`Webapp Testing` y `Claude-Mem` —lo que no los hace malos, pero significa instalar código de
terceros que corre con permisos locales.

La conclusión que importa: **ninguno de los nueve habría evitado un solo defecto de las
secciones A, B o C.** Lo que faltó no fue capacidad de generar código, sino ejecutarlo una
vez.

Correr `pnpm typecheck` una sola vez levanta A4, C5 y buena parte de B3 antes de escribir la
línea siguiente. Ese es el cambio de proceso que este proyecto necesitaba, no una herramienta
nueva.

---

## Orden de trabajo derivado

El detalle operativo vive en [`plans/auth-hardening.md`](../plans/auth-hardening.md). El
orden general:

1. Versionar el estado heredado. *(Hecho: `c41e619`.)*
2. Conseguir que `pnpm install` termine.
3. Levantar la infraestructura y aplicar el schema.
4. Rehacer la autenticación sobre `@fastify/jwt`.
5. Arreglar el aislamiento por familia y probarlo con dos familias.
6. Escribir el módulo que falta y arrancar el servidor.
7. Reconstruir el cliente HTTP desde el OpenAPI.
8. Reparar el ruteo del frontend.
9. Un módulo entero de punta a punta.
