# Rulesets de ramas

Fuente de verdad de la proteccion de `stg` y `main`. Que impone cada uno esta explicado
en [`CODE_GUIDE.md` §6](../../CODE_GUIDE.md).

## Aplicar

Desde la interfaz: _Settings → Rules → Rulesets → New ruleset → Import a ruleset_ y
elegir el JSON.

Desde la terminal, la primera vez:

```bash
gh api repos/LuchoGomez3/homehub/rulesets --input .github/rulesets/stg.json
gh api repos/LuchoGomez3/homehub/rulesets --input .github/rulesets/main.json
```

Para actualizar uno existente hace falta su id:

```bash
gh api repos/LuchoGomez3/homehub/rulesets --jq '.[] | "\(.id) \(.name)"'
gh api -X PUT repos/LuchoGomez3/homehub/rulesets/<id> --input .github/rulesets/stg.json
```

## Cuando `quality` quede verde

Agregar `{ "context": "quality" }` a `required_status_checks` en los dos archivos,
aplicar con el `PUT` de arriba y anotar la fecha en `CODE_GUIDE.md` §5.
