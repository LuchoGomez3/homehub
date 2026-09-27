# 0003 — Dos ramas protegidas, ramas cortas, y el CI decide qué entra

- **Fecha:** 2026-09-12
- **Estado:** Aceptada
- **Afecta a:** todo el repositorio. Las reglas operativas están en
  [`CODE_GUIDE.md`](../../CODE_GUIDE.md); acá está el porqué.

## Contexto

El proyecto ya está vinculado a un repositorio remoto y tiene tres commits, todos sobre
`main`. No hay ninguna regla sobre qué puede entrar ahí ni cómo. El
[análisis inicial](../analysis/2026-09-12-estado-inicial.md) concluyó que el problema de
la primera vuelta no fue la capacidad de generar código sino **la ausencia de un momento
en que ese código se ejecutara**: 6.968 líneas y ninguna corrida de `tsc`.

Hay una segunda condición particular de este proyecto: el trabajo lo hace una persona con
sesiones de asistente que pueden correr en paralelo sobre ramas distintas —hoy mismo hay
una sesión en `auth-hardening` y otra en `chore/reglas-de-desarrollo-y-ci`—. En la
práctica, eso se comporta como un equipo de varias personas: dos líneas de trabajo que
tienen que integrarse sin pisarse y sin que ninguna sepa exactamente qué hizo la otra.

Hace falta, entonces, un lugar donde el código se ejecute obligatoriamente antes de
integrarse, un historial que se pueda leer sin haber estado ahí, y una rama que represente
«lo que funciona» separada de «lo que se está probando».

## Opciones consideradas

**A. Solo `main`, trunk-based.** Ramas cortísimas contra `main`, feature flags para lo que
no está listo, tags para marcar releases. Es el modelo más simple y funciona bien con CI
sólido y despliegue continuo. Pero exige que `main` sea desplegable en todo momento, y hoy
ni siquiera compila: no habría diferencia entre «integrado» y «en producción» durante
meses, y el día que exista producción no habría dónde probar una integración antes de
desplegarla.

**B. `main` + `stg` + ramas cortas.** `stg` es donde el trabajo se integra y se verifica;
`main` es lo que está (o estaría) en producción. Una rama intermedia más que en A, a cambio
de un lugar donde acumular varios cambios y llevarlos juntos a producción como un release
identificable.

**C. Git Flow completo** (`develop`, `release/*`, `hotfix/*`, `feature/*`). Cubre lo mismo
que B con más ceremonia: ramas de release que se abren, estabilizan y cierran. Está pensado
para equipos con versiones numeradas y ciclos largos. Para un producto web que se despliega
cuando está listo, las ramas de release son overhead sin beneficio.

Sobre cómo entran los cambios a `stg`:

- **Squash merge** deja un commit por PR: historial limpio pero se pierde la granularidad.
  El plan de autenticación pide explícitamente «un commit por fase verde» (F8-1); con
  squash, esas fases desaparecen al mergear.
- **Merge commit** conserva los commits pero llena el historial de nodos de merge que no
  dicen nada.
- **Rebase** conserva los commits y mantiene el historial lineal. Obliga a que cada commit
  sea presentable, que es exactamente lo que se quiere exigir.

## Decisión

**Opción B**, con estas reglas concretas:

1. `main` y `stg` están protegidas: no reciben push directo, no se borran, no admiten
   force push. Todo entra por pull request.
2. Las ramas de trabajo nacen de `stg`, se mergean a `stg` con **rebase** y se borran.
3. `stg` se lleva a `main` con un pull request de release y **merge commit**, que queda
   como marcador en la historia de `main`.
4. Los hotfixes nacen de `main`, vuelven a `main` y se llevan a `stg` inmediatamente.
5. Los commits siguen Conventional Commits, **en inglés**, con tipos y ámbitos cerrados en
   `commitlint.config.cjs`, validados por un hook local y por el CI. La documentación se
   mantiene en español: se lee más rápido y hoy tiene un solo lector. El historial de
   commits, en cambio, lo consumen herramientas y eventualmente otras personas, y el
   idioma del ecosistema es el inglés. Los tres commits previos a esta decisión están en
   español y no se reescriben.
6. El CI corre `install`, `typecheck`, `lint`, `test` y `build` en cada PR. El check de
   commits es requerido desde el primer día. El check de calidad se vuelve requerido el
   día que pase en verde por primera vez, no antes.

Sobre el punto 6: se consideró no agregar el job de calidad hasta que el proyecto compile,
para evitar un check rojo permanente. Se descartó porque el job rojo **es la información
correcta**: el proyecto no compila, y el CI tiene que decirlo en cada PR hasta que deje de
ser cierto. Lo que no se hace es _bloquear_ con él, porque bloquearía también los PRs que
lo arreglan.

## Consecuencias

- Hay una rama más que mantener. Cada release es un PR de `stg` a `main`, y cada hotfix
  obliga a un segundo PR de vuelta. Es el costo de tener un lugar donde integrar sin
  desplegar.
- Los pull requests son obligatorios aunque haya un solo desarrollador. Para una persona
  sola es ceremonia; para una persona con varias sesiones de asistente en paralelo es el
  único punto donde las líneas de trabajo se ven entre sí.
- El rebase como método de merge obliga a rebasear la rama antes de integrar cuando `stg`
  avanzó. Con el ruleset exigiendo la rama al día, lo que el CI verificó es exactamente lo
  que entra.
- Los hooks de `husky` se instalan con `pnpm install`, así que hasta que el primer
  `pnpm install` termine (Fase 1 del plan de autenticación) la validación local no existe y
  solo cubre el CI. Se acepta: el CI alcanza para no dejar pasar nada.
- El CD no está implementado. Esta decisión define que `stg` despliega a staging y `main` a
  producción con aprobación manual, pero eso queda condicionado a reescribir los
  Dockerfiles y elegir destino de despliegue, que son decisiones separadas.
- Los rulesets viven versionados en `.github/rulesets/`. Si alguien los cambia desde la
  interfaz de GitHub sin commitear el JSON, el repo miente sobre sus propias reglas. Es el
  mismo riesgo que `docs/flows/` y tiene la misma mitigación: se cambian en el mismo commit.
