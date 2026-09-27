# Documentación de HomeHub

Esta carpeta existe para que el contexto del proyecto sobreviva a la herramienta
con la que se trabaja. Sesiones, cuentas y asistentes van y vienen; el repo queda.

Si algo se decidió, se analizó o se especificó y no está acá, la próxima persona
—o la próxima sesión— lo va a volver a discutir desde cero.

## Qué va en cada carpeta

| Carpeta | Qué contiene | Ciclo de vida |
|---|---|---|
| `analysis/` | Diagnósticos y auditorías: la foto de cómo estaba algo en una fecha. | **No se editan.** Se fechan en el nombre y quedan como registro histórico. Si la realidad cambió, se escribe un análisis nuevo. |
| `decisions/` | Por qué se eligió una opción y no las otras. Un archivo numerado por decisión. | **Se agregan, no se corrigen.** Si una decisión se revierte, se escribe una nueva que la reemplaza y se marca la anterior como superada. |
| `flows/` | Cómo funciona hoy cada flujo del producto: autenticación, gastos, invitaciones. | **Vivos.** Se actualizan en el mismo commit que cambia el código que describen. |
| `plans/` | Checklists de trabajo en curso, con su estado. | **Temporales.** Se archivan o se borran cuando el trabajo termina y lo aprendido pasó a `flows/` o `decisions/`. |

Las reglas de desarrollo —ramas, commits, pull requests, CI— no están acá sino en
[`CODE_GUIDE.md`](../CODE_GUIDE.md) en la raíz, al lado del README, porque son lo primero
que hay que leer antes de tocar código. El porqué de esas reglas sí vive acá, en
`decisions/0003`.

## La regla que sostiene todo esto

Un documento vivo que quedó desactualizado es peor que no tenerlo: se lee con
confianza y miente. Por eso la división de arriba no es cosmética.

- Un **análisis** nunca miente porque está fechado: describe un pasado.
- Una **decisión** nunca miente porque es inmutable: describe lo que se pensó entonces.
- Un **flujo** sí puede mentir. Es el único tipo de documento con riesgo real, y por eso
  la regla es que se toca en el mismo commit que el código. Si cambiás cómo funciona
  el login y no tocaste `flows/auth.md`, el commit está incompleto.

## Índice

### Análisis

- [`analysis/2026-09-12-estado-inicial.md`](analysis/2026-09-12-estado-inicial.md) —
  Auditoría del código heredado de la primera vuelta. Qué impide que arranque, qué
  se rescata y qué hay que reescribir.

### Decisiones

- [`decisions/0001-sesion-en-cookies-httponly.md`](decisions/0001-sesion-en-cookies-httponly.md) —
  Una sola fuente de verdad para la sesión, emitida por la API.
- [`decisions/0002-documentacion-viva-en-el-repo.md`](decisions/0002-documentacion-viva-en-el-repo.md) —
  Por qué existe esta carpeta y qué papel juegan los artefactos visuales.
- [`decisions/0003-ramas-stg-main-y-verificacion-en-ci.md`](decisions/0003-ramas-stg-main-y-verificacion-en-ci.md) —
  Por qué hay una rama `stg`, por qué se mergea con rebase y por qué el CI corre aunque
  esté en rojo.

### Flujos

- [`flows/README.md`](flows/README.md) — Plantilla y criterio para escribir una spec de flujo.

Todavía no hay flujos documentados: el primero será `flows/auth.md`, y se escribe
cuando la autenticación quede funcionando y verificada, no antes.

### Planes

- [`plans/auth-hardening.md`](plans/auth-hardening.md) — En curso. Reemplazar los tokens
  sin firma por JWT reales con revocación.
