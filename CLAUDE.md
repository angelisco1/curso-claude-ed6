# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Visión general

Resttek: plataforma de gestión de restaurantes. Monorepo con **npm workspaces** (`packages/*`): una API (`@resttek/api`, Express 5 + TypeScript + SQLite) y cuatro paquetes Angular 21 (`web-admin` :4200, `web-empleados` :4201, `web-clientes` :4202 y la librería `web-shared`). Requiere Node 22+. La documentación detallada (en español) está en `docs/` (`arquitectura/`, `dominio/`, `revisiones/`).

## Comandos (desde la raíz)

- `npm install`: instala todos los workspaces.
- `npm run dev:api`: API en :3000 con `tsx watch` (`/health` para comprobarla).
- `npm run dev:admin` / `dev:empleados` / `dev:clientes`: cada frontend con `ng serve` y proxy de `/api` → `http://localhost:3000` (`proxy.conf.json`).
- `npm run seed`: puebla la BD (usa `INSERT OR IGNORE`, es idempotente). La contraseña de cada usuario de prueba es su propio email (p. ej. `admin@resttek.com`).
- `npm test`: tests de la API (Vitest). Solo la API tiene tests; los frontends no tienen script de test.
- Un solo test: `cd packages/api && npx vitest run src/services/order.service.test.ts` (o `-t "nombre del test"`). Modo watch: `npm run test:watch` en `packages/api`.
- Build de un frontend: `npm run build -w @resttek/web-admin` (análogo para los otros).

## Arquitectura de la API (`packages/api/src`)

Conviven **dos estilos**; identificar cuál aplica antes de tocar código:

- **Hexagonal + DDD** solo en `contexts/employee/` (`domain/` → `application/` casos de uso → `infrastructure/` con repo SQLite, Bcrypt y `http/`). `Employee` es la única entidad de dominio (constructor privado + `create()`), con value objects `Email` (en `contexts/shared`) y `Role`. La composición de dependencias está en `infrastructure/http/dependencies.ts`.
- **Por capas** para `restaurant`, `dish`, `ingredient`, `order`, `table` (mesas): carpetas transversales `models/` (interfaces planas), `repositories/`, `services/`, `controllers/`, `routes/` (las rutas componen las dependencias). La validación vive en los servicios.

Otros detalles:
- Alias de rutas en `tsconfig.json` (`@services/*`, `@repositories/*`, `@employee/*`, `@shared/*`, etc.); Vitest los resuelve con `vite-tsconfig-paths`. Módulos ESM (`"type": "module"`, `module: nodenext`), con `strict`, `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes` activados.
- Errores en `errors/` (`AppError`, `DomainErrors`) y `errorHandler` en `contexts/shared/infrastructure/http/`, que mapea por nombre a 404/401/403/409 (listas `NOT_FOUND_ERRORS`, `UNAUTHORIZED_ERRORS`, `FORBIDDEN_ERRORS`, `CONFLICT_ERRORS`) y 400 por defecto. **Los mensajes de error van en español** (el campo `error` es el nombre de la clase y no se traduce); los middlewares de auth responden solo `{ error: '<texto>' }`, sin `message`. Auth con JWT: middlewares `authenticate` / `authorize` (roles) en `middlewares.ts`.
- SQLite en `packages/api/resttek.db`; las tablas se crean al arrancar (migraciones en código en `config/database.ts`). Con `NODE_ENV=test` se usa `:memory:`.
- Tests junto al código (`*.test.ts`); los repositorios usan mocks en `repositories/mocks` y `application/mocks`.
- Rutas bajo `/api/v1/...`. El contrato de mesas y de `POST /orders` está en `docs/arquitectura/openapi-mesas.yaml`.
- Mesas: tabla `restaurant_tables`; un cliente ocupa como mucho una mesa (`occupied_by`, ocupación atómica en `occupyIfFree`) y `orders.table_id` guarda el id de la mesa (sin FK; los valores antiguos se muestran tal cual).

## Arquitectura del frontend

Angular 21 standalone, signals y **zoneless**. Las tres apps son feature-based pero **no idénticas**:
- `web-admin` y `web-empleados`: `features/<feature>/{models,pages,services,store}`; estado en stores con signals, llamadas HTTP envueltas en `firstValueFrom`.
- `web-clientes`: modelos y servicios centralizados en `core/`; los componentes consumen los `Observable` con `.subscribe()`.
- `web-shared` (`main: src/index.ts`, sin build propio) aporta auth, interceptors y componentes comunes; es la única dependencia entre paquetes. Si los cambios en `web-shared` no se reflejan, reinicia el dev server del frontend.

## Otros

- `scripts/seed-issues.sh` crea issues de GitHub desde `scripts/issues.json` (requiere `gh` y `jq`; ver `scripts/README.md`).
- Al documentar, escribe en español.
