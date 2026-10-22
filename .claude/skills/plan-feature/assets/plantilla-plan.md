# Plan: <título corto de la funcionalidad o bug>

- **Issue**: #<número>
- **Tipo**: feature | bugfix
- **Fecha**: <AAAA-MM-DD>
- **Estado**: pendiente

## 1. Contexto y objetivo

<Qué se quiere conseguir y por qué. En un bug: comportamiento actual vs. esperado y pasos para reproducirlo.>

## 2. Alcance

**Incluye**

- <qué entra en el plan>

**No incluye**

- <qué queda fuera a propósito>

## 3. Análisis del código actual

<Archivos, capas y funciones afectadas, con rutas (p. ej. `src/services/vendehumo.service.js`). En un bug, causa raíz identificada.>

## 4. Diseño de la solución

<Enfoque elegido y decisiones relevantes: endpoints (método, ruta, códigos de estado), cambios en el modelo/esquema SQLite, validaciones, respuestas de error. Alternativas descartadas si aportan contexto.>

## 5. Lista de tareas

Cada tarea debe poder hacerse en 5-10 minutos. Sigue el orden de las capas: models → repositories → services → controllers → routes.

- [ ] **T1** (~5 min) — <acción concreta> — `ruta/archivo.js`
- [ ] **T2** (~10 min) — <acción concreta> — `ruta/archivo.js`

## 6. Plan de pruebas

<Cómo verificar el cambio: peticiones de ejemplo (curl) con resultado esperado, casos límite y regresiones a comprobar. El proyecto no tiene framework de tests.>

## 7. Documentación a actualizar

- [ ] <CLAUDE.md, docs/..., u "ninguna">

## 8. Riesgos y dudas abiertas

- <riesgos, impacto en compatibilidad (cambios incompatibles) o preguntas pendientes>
