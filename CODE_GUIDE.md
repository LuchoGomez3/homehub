# Guía de código

Este documento define cómo se trabaja en el repositorio: qué ramas existen, cómo se
nombran, cómo se escriben los commits, cómo entra un cambio a `stg` y a `main`, y qué
verifica el CI antes de dejarlo pasar.

Hoy el proyecto lo desarrolla una sola persona, con sesiones de asistente que a veces
trabajan en paralelo. No está abierto a contribuciones externas. Las reglas existen igual,
por dos motivos: las sesiones paralelas se comportan como varios desarrolladores y
necesitan un punto de integración, y cuando el proyecto madure y entre más gente, este
documento pasa a ser el `CONTRIBUTING.md` sin tener que inventarlo desde cero.

La motivación está en [`docs/decisions/0003`](docs/decisions/0003-ramas-stg-main-y-verificacion-en-ci.md).
Acá está solo la regla. Si una regla y este documento se contradicen con lo que hace el
CI, el CI está mal y se arregla; el documento manda.

Las herramientas (`commitlint`, `husky`, los workflows de GitHub Actions y los rulesets)
existen para que estas reglas no dependan de la memoria. Si algo de lo que sigue se puede
verificar automáticamente y no se verifica, es un bug de este documento.

**Idiomas.** La documentación se escribe en español, para que se lea rápido. Los commits,
los nombres de rama, los títulos de pull request y el código (identificadores, comentarios)
se escriben en **inglés**: es lo que va a leer cualquier herramienta, cualquier persona
que se sume después, y es el idioma del ecosistema.

---

## 1. Ramas

```
main ──────●──────────────●────────────  producción. Solo recibe merges desde stg
            \            /               (o desde hotfix/*).
stg ─────────●────●─────●──────●───────  integración. Todo el trabajo entra acá primero.
              \  /       \    /
feat/x ────────●          ●──●           ramas cortas, nacen y mueren en stg.
```

| Rama                                                                   | Qué es                                                                                                                             | Quién escribe                                |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `main`                                                                 | Lo que está en producción, o lo que estaría si hubiera producción. Siempre desplegable.                                            | Solo pull requests desde `stg` o `hotfix/*`. |
| `stg`                                                                  | Integración. Lo que va a ser la próxima versión de `main`. Puede tener trabajo a medio verificar, pero **cada commit pasó el CI**. | Solo pull requests desde ramas de trabajo.   |
| `feat/*`, `fix/*`, `refactor/*`, `chore/*`, `docs/*`, `test/*`, `ci/*` | Trabajo en curso. Nacen de `stg`, viven días, no semanas.                                                                          | Push directo.                                |
| `hotfix/*`                                                             | Un arreglo urgente en producción. Nace de `main`, vuelve a `main`, y después se lleva a `stg`.                                     | Push directo.                                |

**Nadie hace push directo a `stg` ni a `main`.** Los rulesets del repositorio lo impiden
(ver §6). No es desconfianza: es que el CI corre sobre pull requests, y un push directo lo
saltea.

### Nombre de rama

`type/short-description-in-kebab-case`, en inglés, en minúsculas, sin espacios.

```
feat/shopping-list
fix/reused-refresh-token
chore/code-guide-and-ci
hotfix/cors-in-production
```

El tipo es el mismo del commit principal que va a contener (§2). La descripción dice qué
se hace, no dónde: `feat/shopping-list`, no `feat/apps-web`.

### Ciclo de vida

1. Nace de `stg` actualizada: `git switch stg && git pull && git switch -c feat/whatever`.
2. Se trabaja en commits atómicos (§2).
3. Se abre un pull request contra `stg` (§3).
4. Se mergea con **rebase** (historia lineal, los commits llegan tal cual se escribieron).
5. La rama se borra. Si el trabajo continúa, se abre otra.

Si `stg` avanzó mientras la rama estaba abierta, se rebasea sobre `stg` antes de mergear
(`git rebase stg`). El CI exige que la rama esté al día, así que lo que se verificó es
exactamente lo que entra.

---

## 2. Commits

Se sigue [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/). El
formato lo valida `commitlint` en dos lugares: un hook local al commitear y el job
`commits` del CI sobre cada pull request. Un mensaje que no cumple no entra.

```
type(scope): subject in lowercase, no trailing period, 72 characters max

Optional body. Explains WHY the change is made and which alternatives were
discarded. The WHAT is already in the diff. Lines up to 100 characters.

Refs: #12
Co-Authored-By: Name <email>
```

Todo el mensaje va en **inglés**. Los tres primeros commits del repositorio están en
español; quedan como están (no se reescribe historia publicada) y son la excepción.

### Tipos

| Tipo       | Cuándo                                                   | Ejemplo                                              |
| ---------- | -------------------------------------------------------- | ---------------------------------------------------- |
| `feat`     | Agrega comportamiento visible para el usuario o la API.  | `feat(api): add shopping list endpoints`             |
| `fix`      | Corrige comportamiento incorrecto.                       | `fix(auth): reject rotated refresh tokens`           |
| `refactor` | Cambia la estructura sin cambiar el comportamiento.      | `refactor(api): move module augmentations to types/` |
| `perf`     | Mejora de rendimiento sin cambio funcional.              | `perf(web): memoize the expenses list`               |
| `test`     | Solo agrega o corrige tests.                             | `test(auth): forged token returns 401`               |
| `docs`     | Solo documentación.                                      | `docs: auth flow spec`                               |
| `chore`    | Mantenimiento que no toca código de producción ni tests. | `chore: ignore local Claude Code settings`           |
| `ci`       | Workflows, rulesets, hooks.                              | `ci: run typecheck and lint on pull requests`        |
| `build`    | Sistema de build, dependencias, Dockerfiles.             | `build(deps): bump prisma to 5.16`                   |
| `style`    | Formato puro (prettier), sin cambio semántico.           | `style(ui): format components with prettier`         |
| `revert`   | Revierte un commit anterior. Citar el hash en el cuerpo. | `revert: feat(api): add shopping list endpoints`     |

Un cambio que hace dos cosas de tipos distintos son dos commits. Si no se puede separar,
el tipo es el del cambio más importante para quien lea el historial, y el cuerpo explica
el resto.

### Ámbitos

Opcional pero recomendado. Si se usa, tiene que ser uno de estos:

| Ámbito    | Cubre                                                                       |
| --------- | --------------------------------------------------------------------------- |
| `api`     | `apps/api`                                                                  |
| `web`     | `apps/web`                                                                  |
| `shared`  | `packages/shared`                                                           |
| `ui`      | `packages/ui`                                                               |
| `config`  | `packages/config`                                                           |
| `auth`    | Autenticación y sesión, en cualquier workspace. Es transversal a propósito. |
| `db`      | Schema de Prisma, migraciones, seed.                                        |
| `deps`    | Dependencias, normalmente con `build`.                                      |
| `release` | Pull requests de `stg` a `main`.                                            |

La lista vive en [`commitlint.config.cjs`](commitlint.config.cjs). Si hace falta un ámbito
nuevo, se agrega ahí y en esta tabla, en el mismo commit.

### Asunto

- En inglés, en minúscula, sin punto final.
- Imperativo: «add endpoint», «reject unsigned tokens». No «added», no «adds». La prueba:
  el asunto completa la frase _«if applied, this commit will …»_.
- Dice qué cambia, no dónde: `fix(auth): reject unsigned tokens`, no
  `fix(auth): changes in auth.ts`.
- Cabe en 72 caracteres con el tipo y el ámbito incluidos.

### Cuerpo

Obligatorio cuando el porqué no es evidente. Es la parte que más vale a los seis meses.

Un buen cuerpo responde: ¿qué problema había? ¿por qué esta solución y no otra? ¿qué
quedó fuera a propósito? Si se verificó algo, cómo:

```
fix(auth): reject already-rotated refresh tokens

A refresh token stayed valid after being used because there was no
server-side state. Each token is now stored hashed in RefreshToken and
rotating it marks the previous one as revoked.

Verified with curl: rotate once and retry with the old token returns
401 (it used to return 200 and a fresh pair).
```

### Commits atómicos y verdes

Cada commit deja el proyecto en un estado coherente: compila, o al menos no está peor que
el commit anterior. No hay commits «wip», «fix», «misc fixes» ni «changes». Si el
trabajo está a medio hacer, se termina o se descarta; no se commitea.

Antes de abrir el pull request, si el historial de la rama tiene commits de ida y vuelta,
se limpia con `git rebase -i stg`. Lo que llega a `stg` es la versión editada, no el
borrador.

### La documentación va en el mismo commit

Regla heredada de [`docs/README.md`](docs/README.md): si un cambio modifica cómo funciona
un flujo documentado en `docs/flows/`, el archivo del flujo se actualiza en el mismo
commit. Un commit que cambia el login y no toca `flows/auth.md` está incompleto.

Lo mismo con `.env.example`: si se agrega una variable de entorno, se agrega ahí en el
mismo commit.

---

## 3. Pull requests a `stg`

Un pull request es la unidad de revisión y la unidad de CI. Se abre contra `stg`, se
mergea con **rebase** y la rama se borra.

**Título:** el mismo formato que un commit, en inglés: `type(scope): subject`. Si el PR tiene un solo
commit, es ese. Si tiene varios, el título resume el conjunto.

**Descripción:** la plantilla en [`.github/pull_request_template.md`](.github/pull_request_template.md)
pide tres cosas, y las tres son obligatorias:

1. **Qué cambia y por qué.** Dos párrafos como mucho. Los detalles están en los commits.
2. **Cómo se verificó.** Los comandos que se corrieron y qué devolvieron. «Anda» no es una
   verificación. «`pnpm typecheck` verde; `curl /api/auth/me` sin cookie devuelve 401» sí.
3. **Qué quedó afuera.** Lo que se vio y no se tocó a propósito, para que la próxima
   persona no lo redescubra.

**Tamaño:** un PR se revisa entero o no se revisa. Más de ~400 líneas de diff sin contar
lockfile y snapshots es señal de que había dos PRs.

**Para mergear hace falta:**

- El job `commits` del CI en verde.
- El job `quality` del CI en verde (ver §5 sobre el estado actual).
- La rama al día con `stg`.
- Todas las conversaciones de la revisión resueltas.

El merge lo hace quien abrió el PR, una vez que las condiciones se cumplen.

---

## 4. Pull requests a `main`

`main` recibe cambios de dos lugares: `stg` (lo normal) y `hotfix/*` (lo excepcional).

### De `stg` a `main`: un release

- Se abre un PR de `stg` a `main` titulado `release: <what it ships, one line, in English>`.
- La descripción enumera qué entra, agrupado por módulo, y qué hay que hacer en el
  entorno además del deploy: variables nuevas, migraciones, datos que hay que tocar a
  mano.
- Se mergea con **merge commit** (nunca squash, nunca rebase). Ese commit de merge es el
  marcador del release en la historia de `main`; `stg` y `main` quedan con la misma
  historia debajo.
- Cuando el CD exista (§7), ese merge es lo que despliega a producción.

### De `hotfix/*` a `main`

Solo para un problema en producción que no puede esperar al próximo release.

1. `git switch main && git pull && git switch -c hotfix/whatever`.
2. El commit es `fix(...)` como cualquier otro.
3. PR contra `main`, con las mismas exigencias de CI que un PR a `stg`.
4. Merge con **merge commit**.
5. Inmediatamente después, un PR de `main` a `stg` para que la corrección no se pierda en
   el próximo release. Si `stg` ya cambió ese código, el conflicto se resuelve ahí.

---

## 5. CI: qué se verifica y cómo correrlo antes

El workflow está en [`.github/workflows/ci.yml`](.github/workflows/ci.yml). Corre en cada
pull request a `stg` y a `main`, y en cada push a esas dos ramas. Tiene dos jobs
independientes:

| Job       | Qué hace                                                                                                       | Equivalente local                                                                   |
| --------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `commits` | Valida con `commitlint` cada commit del PR contra `commitlint.config.cjs`.                                     | El hook `commit-msg` lo hace al commitear. Manualmente: `npx commitlint --from stg` |
| `quality` | `pnpm install --frozen-lockfile`, `prisma generate`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`. | Los mismos comandos, en ese orden.                                                  |

Ambos son **checks requeridos** en los rulesets de `stg` y `main`: sin verde, no hay
merge.

### Antes de abrir un PR

```bash
pnpm install --frozen-lockfile   # el lockfile tiene que estar al dia y commiteado
pnpm --filter @homehub/api exec prisma generate
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Si algo de esto falla localmente va a fallar en el CI. Abrir el PR igual para «ver qué
dice» gasta minutos de Actions y no aporta información.

### Formato

Prettier se aplica **incrementalmente**: el hook `pre-commit` (vía `lint-staged`) formatea
los archivos que se están commiteando. No hay un `prettier --check` global en el CI todavía
porque el árbol heredado tiene 78 archivos sin formatear, la mayoría código que el análisis
inicial marca para descartar; formatearlo todo hoy sería un diff enorme sobre código que se
va a tirar. Cuando el árbol quede limpio (`pnpm format:check` en verde), se agrega ese paso
al job `quality` y se anota acá.

### Estado actual del job `quality`

Al momento de escribir esto (2026-09-12), **`quality` está en rojo y va a seguir así hasta
que se complete la Fase 1 y 2 del [plan de autenticación](docs/plans/auth-hardening.md)**.
No es un problema del CI: es que el proyecto nunca pasó por un `pnpm install` (ver
[`docs/analysis/2026-09-12-estado-inicial.md`](docs/analysis/2026-09-12-estado-inicial.md)).
Para que quede verde hace falta, en orden:

1. ~~`pnpm-lock.yaml` commiteado (F1-3 del plan).~~ Hecho con el plan de auth.
   `pnpm install --frozen-lockfile` pasa.
2. `pnpm typecheck` sin errores en los cuatro workspaces. **`@homehub/api` ya está en cero**
   (F7-1, 2026-09-27). Los otros tres fallan por configuración de TypeScript más que
   por código: `web` tiene el `rootDir` apuntando fuera de la app, y `shared` y `ui` no
   tienen JSX habilitado ni resuelven sus módulos.
3. Un `.eslintrc` real en `packages/config` que los cuatro workspaces hereden (hallazgo A8).
4. Que `vitest run` no falle sin tests: `--passWithNoTests` o, mejor, el primer test (A8).
5. Que `next build` termine, lo que depende de C1–C5 del análisis.

Mientras tanto, el único check requerido en los rulesets es `commits`. `quality` se marca
como requerido **el mismo día que pasa en verde por primera vez**, y ese cambio se registra
acá. Un check que está rojo desde siempre se aprende a ignorar, y ese es el peor estado
posible para un CI.

### Hooks locales

`husky` instala dos hooks al correr `pnpm install`:

- `commit-msg`: `commitlint` sobre el mensaje. Rechaza el commit si no cumple §2.
- `pre-commit`: `lint-staged` corre `prettier --write` sobre los archivos staged.

No se saltean con `--no-verify`. Si un hook molesta, se discute y se cambia el hook.

---

## 6. Protección de ramas

Los rulesets están versionados en [`.github/rulesets/`](.github/rulesets/) como JSON,
importables desde _Settings → Rules → Rulesets → Import_. Lo que imponen:

| Regla                        | `stg`                                                    | `main`                                  |
| ---------------------------- | -------------------------------------------------------- | --------------------------------------- |
| Borrar la rama               | No                                                       | No                                      |
| Force push                   | No                                                       | No                                      |
| Push directo                 | No: solo vía pull request                                | No: solo vía pull request               |
| Método de merge permitido    | Rebase                                                   | Merge commit                            |
| Checks requeridos            | `commits` (`quality` cuando esté verde)                  | `commits` (`quality` cuando esté verde) |
| Rama al día antes de mergear | Sí                                                       | Sí                                      |
| Conversaciones resueltas     | Sí                                                       | Sí                                      |
| Aprobaciones requeridas      | 0 (un solo desarrollador hoy; subir a 1 cuando haya dos) | 0 (ídem)                                |

El JSON versionado es la fuente de verdad. Si se cambia algo desde la interfaz de GitHub,
se exporta y se commitea con un commit `ci:`.

---

## 7. CD: cómo va a funcionar

**Todavía no está implementado.** Lo que sigue es el diseño, para que cuando se haga no se
discuta desde cero.

| Evento                                       | Entorno      | Qué pasa                                                                                    |
| -------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------- |
| Push a `stg` (es decir: merge de un PR)      | `staging`    | Build de las imágenes de `api` y `web`, deploy automático. Sin aprobación manual.           |
| Push a `main` (merge de un release o hotfix) | `production` | Build, deploy. Con **aprobación manual** configurada en el GitHub Environment `production`. |

Los secretos viven en GitHub Environments (`staging`, `production`), nunca en el
workflow ni en el repo. `.env.example` documenta qué variables existen; el Environment
tiene los valores.

### Prerrequisitos que hoy no se cumplen

1. **Los Dockerfiles no sirven para un monorepo.** Usan `apps/api` y `apps/web` como
   contexto de build, copian un `pnpm-lock.yaml` que vive en la raíz, y `apps/web/Dockerfile`
   hace `COPY ../packages`, que Docker no permite. Hay que reescribirlos con la raíz del
   repo como contexto y `pnpm deploy --filter` para producir una imagen por app.
2. **Hay dos archivos de compose y debería haber uno.** `docker-compose.yml` tiene la
   contraseña de Postgres hardcodeada y Redis sin contraseña; `docker-compose.prod.yml`
   repite los mismos servicios leyendo todo de variables, y agrega `api` y `web`. La regla
   es que **el entorno se elige con variables, no con archivos**: un solo compose, con los
   valores en `${VARIABLES}` para todos los entornos, y `api`/`web` bajo un profile
   (`COMPOSE_PROFILES=apps` en stg y prod, nada en local, donde las apps corren en el host
   con hot reload). Adminer ya funciona así con `profiles: [tools]`. Al unificar,
   desaparecen también las variables `NEXTAUTH_*`, que la decisión 0001 eliminó.
3. **No hay destino.** El README nombra Vercel y Render; el compose de prod sugiere un
   servidor propio. Son dos estrategias distintas; hay que elegir una y escribir la
   decisión en `docs/decisions/`.
4. **El job `quality` tiene que estar verde.** No se despliega lo que no compila.

Cuando esos cuatro puntos se resuelvan, el workflow se llama `cd.yml`, se documenta en esta
sección y esta nota se borra.

---

## 8. Resumen operativo

```bash
# empezar
git switch stg && git pull
git switch -c feat/whatever

# trabajar: commits atomicos, en ingles, con tipo y ambito
git commit -m "feat(api): add shopping list endpoints"

# antes del PR
git fetch origin && git rebase origin/stg
pnpm typecheck && pnpm lint && pnpm test && pnpm build

# abrir el PR contra stg, esperar CI verde, mergear con rebase, borrar la rama
gh pr create --base stg
```
