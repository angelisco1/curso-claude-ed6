---
description: Crea un commit siguiendo la especificación Conventional Commits
argument-hint: [contexto o pista opcional sobre el cambio]
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*)
---

# Commit con Conventional Commits

Crea un commit de los cambios actuales siguiendo la especificación [Conventional Commits 1.0.0](https://www.conventionalcommits.org/es/v1.0.0/).

## Contexto

- Estado del repositorio: !`git status --short`
- Cambios en el área de preparación (staged): !`git diff --cached`
- Cambios sin preparar: !`git diff`
- Rama actual: !`git branch --show-current`
- Últimos commits (para respetar el estilo del proyecto): !`git log --oneline -10 2>/dev/null || echo "(aún no hay commits)"`

Pista del usuario (opcional): $ARGUMENTS

## Formato

```
<tipo>[ámbito opcional][!]: <descripción>

[cuerpo opcional]

[pie(s) opcional(es)]
```

### Tipos permitidos

| Tipo       | Cuándo usarlo                                                        |
| ---------- | -------------------------------------------------------------------- |
| `feat`     | Nueva funcionalidad (SemVer MINOR)                                   |
| `fix`      | Corrección de un error (SemVer PATCH)                                |
| `docs`     | Solo documentación                                                   |
| `style`    | Formato que no afecta al significado del código (espacios, comas...) |
| `refactor` | Cambio de código que no corrige un error ni añade funcionalidad      |
| `perf`     | Mejora de rendimiento                                                |
| `test`     | Añadir o corregir tests                                              |
| `build`    | Sistema de build o dependencias (npm, package.json...)               |
| `ci`       | Configuración de integración continua                                |
| `chore`    | Tareas de mantenimiento que no tocan `src` ni tests                  |
| `revert`   | Revierte un commit anterior                                          |

### Reglas

1. **Descripción**: en español, en imperativo y minúscula inicial (p. ej. `añade endpoint de categorías`), sin punto final y de máximo 72 caracteres en la primera línea.
2. **Ámbito** (opcional): sustantivo entre paréntesis que indica la parte afectada, p. ej. `auth`, `vendehumos`, `db`, `middlewares`.
3. **Cuerpo** (opcional): separado por una línea en blanco; explica el *qué* y el *porqué*, no el *cómo*. Se ajusta a ~72 columnas.
4. **Cambios incompatibles**: añade `!` tras el tipo/ámbito (`feat(auth)!: ...`) y/o un pie `BREAKING CHANGE: <explicación>`.
5. **Pies**: formato `Clave: valor` o `Clave #valor` (p. ej. `Refs: #12`, `Closes #34`).
6. Un commit = un cambio lógico. Si los cambios mezclan varios propósitos independientes, propón dividirlos en varios commits y prepáralos por separado.

## Pasos

1. Analiza el contexto anterior. Si no hay ningún cambio (ni staged ni sin preparar), avisa al usuario y detente.
2. Si hay cambios staged, commitea solo esos. Si no hay ninguno staged, añade con `git add` los archivos relevantes **por nombre** (nunca `git add -A` ni `git add .`) y evita archivos sensibles (`.env`, credenciales, bases de datos `*.db`) o generados.
3. Elige el tipo y el ámbito que mejor describan el cambio. Si dudas entre varios tipos, usa el de mayor impacto para el usuario de la API (`feat` > `fix` > resto).
4. Redacta el mensaje cumpliendo las reglas anteriores y muestraselo al usuario utilizando la tool `AskUserQuestion` para preguntarle si le parece bien el mensaje. Si no le parece bien, genera otro mensaje y le vuelves a preguntar. Cuando lo de por válido sigue con el paso 5.
5. Créalo con `git commit` pasando el mensaje mediante `-m` (un `-m` por párrafo, o un heredoc si es multilínea).
6. Termina el mensaje con la línea de coautoría indicada por el entorno (`Co-Authored-By: ...`), si la hay, como último pie.
7. Ejecuta `git status` tras el commit para confirmar que ha funcionado y muestra al usuario el mensaje final.

## Restricciones

- No hagas `git push`, no cambies de rama ni reescribas el historial (`--amend`, `rebase`, `reset`) salvo petición explícita.
- No uses `--no-verify` para saltarte hooks. Si un hook falla, corrige el problema y crea un commit nuevo.
- No inventes cambios que no aparezcan en el diff.
