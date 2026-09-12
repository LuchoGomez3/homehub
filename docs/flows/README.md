# Specs de flujos

Un flujo describe **cómo funciona hoy** una parte del producto de punta a punta: qué pasa
desde que el usuario hace algo hasta que el sistema queda en un estado nuevo.

No es documentación de API —para eso está el OpenAPI que Fastify genera solo en `/docs`—
ni una explicación del código. Es el recorrido completo, cruzando las capas que haga falta.

## Cuándo se escribe uno

Cuando el flujo ya funciona y está verificado. Escribir la spec de algo que todavía no
corre produce ficción: es justamente lo que pasó en la primera vuelta del proyecto.

El plan de trabajo va en `plans/`. Cuando el trabajo cierra y el flujo anda, lo que se
aprendió baja acá.

## Cuándo se actualiza

**En el mismo commit que cambia el código que describe.** Sin excepción.

Un flujo desactualizado es peor que ninguno: se lee con confianza y miente. Si cambiaste el
login y no tocaste `flows/auth.md`, el commit está incompleto.

## Qué tiene que contestar

Una spec de flujo sirve si alguien que no escribió el código puede leerla y saber qué
esperar. Como mínimo:

- **Disparador** — qué lo inicia, y quién puede iniciarlo.
- **Recorrido** — los pasos en orden, nombrando los archivos reales que intervienen.
- **Estado** — qué queda guardado y dónde, cuando el flujo termina bien.
- **Casos de error** — qué puede fallar, qué ve el usuario y en qué estado queda el sistema.
- **Reglas que no se ven en el código** — decisiones de negocio, límites, plazos. Lo que
  alguien rompería sin darse cuenta.
- **Cómo se prueba** — el recorrido concreto para verificarlo a mano. Idealmente incluyendo
  una comprobación que fallaría si el flujo se rompe, no solo una que pasa cuando anda.

## Plantilla

```markdown
# Flujo: <nombre>

- **Última verificación:** <fecha> contra <entorno>
- **Código:** <rutas principales>

## Disparador

## Recorrido

## Estado resultante

## Casos de error

| Situación | Respuesta | Estado del sistema |
|---|---|---|

## Reglas de negocio

## Cómo verificarlo
```
