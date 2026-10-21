---
name: plan-feature
description: Planifica cómo implementar una nueva funcionalidad o corregir un bug de la API y genera un plan detallado en docs/plans/. Úsala cuando el usuario pida planificar, diseñar o preparar el trabajo antes de programarlo. No implementa código.
argument-hint: <descripción de la funcionalidad o del bug>
---

# Planificar una funcionalidad o un bug

Genera un plan detallado en `docs/plans/` para la petición del usuario: $ARGUMENTS

**Esta skill solo planifica. No modifiques código de `src/`.**

## Pasos

1. **Entiende la petición.** Si es ambigua (alcance, comportamiento esperado, códigos de error), haz las preguntas imprescindibles al usuario antes de seguir. Si es un bug, intenta reproducirlo o localizar la causa raíz leyendo el código.
2. **Explora el código afectado** siguiendo el flujo `routes` → `controllers` → `services` → `repositories` → SQLite. Lee también `CLAUDE.md` y los documentos de `docs/` relevantes (p. ej. `docs/api/api-pagination.md` si toca un GET que lista datos) para respetar las convenciones del proyecto.
3. **Diseña la solución** respetando la arquitectura por capas y las convenciones de `CLAUDE.md` (mensajes en español, `400 { errors: [...] }`, `404 { error: '...' }`, SQL con sentencias preparadas, sin dependencias nuevas salvo necesidad justificada).
4. **Lee la plantilla** [assets/plantilla-plan.md](assets/plantilla-plan.md) y úsala como estructura del plan: mismas secciones, mismo orden y mismos títulos. No elimines secciones; si una no aplica, escribe "No aplica" con una frase de motivo.
5. **Escribe el plan** en `docs/plans/<AAAA-MM-DD>-<slug>.md`:
   - `slug` en kebab-case, corto y sin acentos (p. ej. `2026-10-15-filtro-por-categoria.md`). Para bugs, prefija el slug con `fix-`.
   - Crea la carpeta `docs/plans/` si no existe.
   - Si ya existe un archivo con ese nombre, no lo sobrescribas: pregunta al usuario o añade un sufijo numérico.
6. **Resume al usuario** el plan (objetivo, nº de tareas y dudas abiertas) y enlaza el archivo creado. No empieces a implementar salvo que lo pida.
7. **Avisa por Slack** de que el plan está listo para revisar: publica un mensaje en el canal `planes-ed8` (ID `C0CAKE90QFR`) con la herramienta `mcp__slack__slack_post_message` (si su esquema no está cargado, cárgalo antes con `ToolSearch`). El mensaje, en español, debe incluir el título del plan, la ruta del archivo (`docs/plans/<AAAA-MM-DD>-<slug>.md`), el nº de tareas y las dudas abiertas (si las hay). Ejemplo: `📝 Plan listo para revisar: *<título>* — \`docs/plans/<archivo>.md\` (<n> tareas, <m> dudas abiertas).` Si el envío falla, no lo reintentes en bucle: indícalo al usuario en el resumen.

## Reglas para la lista de tareas

- Cada tarea debe poder completarse en **5-10 minutos**. Si una tarea parece más larga, divídela.
- Formato: `- [ ] **T<n>** (~<5|10> min) — <acción concreta> — \`ruta/archivo.js\``.
- Cada tarea tiene un único resultado verificable e indica el archivo que toca.
- Ordénalas por dependencias y por capas: models → repositories → services → controllers → routes → documentación.
- Incluye tareas explícitas de verificación (probar con `curl` o similar) y de actualización de documentación (`CLAUDE.md`, `docs/`) cuando proceda.
- Para un bug, la primera tarea debe ser reproducirlo y, si es posible, la penúltima comprobar que no hay regresiones.

## Reglas de redacción

- Todo el plan en español.
- Sé concreto: rutas de archivos, nombres de funciones, endpoints, códigos de estado y ejemplos de petición/respuesta. Evita generalidades.
- No inventes comportamiento del código: verifica leyendo los archivos antes de afirmarlo.
