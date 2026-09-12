# 0002 — La documentación viva vive en el repo

- **Fecha:** 2026-09-12
- **Estado:** Aceptada

## Contexto

El análisis inicial del proyecto y la checklist de trabajo se produjeron primero como
artefactos visuales publicados en claude.ai. Son cómodos de leer y de compartir, pero
tienen una propiedad que los descalifica como registro: **quedan atados a la cuenta que
los publicó.**

Un artefacto que declara almacenamiento persistente queda además marcado como interno de
la organización dueña, así que no se puede pasar ni siquiera a una cuenta personal de otro
dominio. Si se cambia de cuenta, de proveedor o de herramienta, ese contenido no se migra:
se pierde.

El proyecto ya pagó una vez el costo de perder contexto. La primera vuelta se generó con
otro asistente, sin decisiones escritas en ningún lado, y el resultado fue código que nadie
podía explicar ni verificar.

## Decisión

Todo análisis, decisión, spec de flujo y plan de trabajo que valga la pena conservar se
escribe como Markdown en `docs/` y se versiona con el código.

Los artefactos visuales pasan a ser una **vista** sobre ese contenido, nunca su origen.
Se usan cuando aportan algo que el Markdown no da —una checklist que se tilda en vivo, un
gráfico, una maqueta navegable— y se aceptan como desechables. Si un artefacto desaparece,
no se pierde nada que no esté en el repo.

Cuando un artefacto y un archivo de `docs/` cubren el mismo contenido, el archivo manda.

## Consecuencias

- El contexto sobrevive al cambio de cuenta, de máquina y de herramienta.
- La documentación se revisa en los mismos pull requests que el código, en vez de vivir
  en un lugar donde nadie la mira.
- Hay un costo real: mantener `flows/` al día es trabajo recurrente, y un flujo
  desactualizado es peor que ninguno. Por eso la regla de `docs/README.md` es que un flujo
  se actualiza en el mismo commit que el código que describe.
- Se pierde la comodidad de tildar una checklist desde el teléfono. Se compensa
  espejando los planes activos en un artefacto mientras duran.
