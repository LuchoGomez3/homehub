<!-- Titulo del PR: type(scope): subject, en ingles, igual que un commit. Reglas en CODE_GUIDE.md §3. -->

## Qué cambia y por qué

<!-- Dos parrafos como mucho. El detalle esta en los commits. -->

## Cómo se verificó

<!-- Comandos que corriste y que devolvieron. "Anda" no es una verificacion. -->

```
pnpm typecheck  →
pnpm lint       →
pnpm test       →
```

## Qué quedó afuera

<!-- Lo que viste y no tocaste a proposito, para que nadie lo redescubra. "Nada" es una respuesta valida. -->

---

- [ ] Los commits siguen Conventional Commits y cada uno deja el proyecto coherente.
- [ ] Si cambia un flujo documentado en `docs/flows/`, el archivo se actualizó en el mismo commit.
- [ ] Si se agregó una variable de entorno, está en `.env.example`.
- [ ] La rama está rebaseada sobre `stg` (o sobre `main` si es un hotfix).
