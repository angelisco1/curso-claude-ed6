# Plan: corregir las vulnerabilidades OWASP Top 10 de la API

- **Tipo**: bugfix
- **Fecha**: 2026-10-21
- **Estado**: pendiente

## 1. Contexto y objetivo

Una auditoría de solo lectura de `packages/api` (2026-10-21) detectó fallos de control de acceso, secretos, autenticación y configuración. Este plan corrige la parte de **API** de los hallazgos. Las tareas de `web-empleados` / `web-shared` (guards por rol, validación de `exp`, CSP, interceptor) quedan en un plan aparte. El documento de contexto, con todos los hallazgos y las decisiones, es `docs/plans/correccion-vulnerabilidades-owasp.md`.

**Comportamiento actual (reproducible leyendo el código):**

- Un `manager` del restaurante A puede hacer `POST /api/v1/restaurants/B/dishes`. `authorize` solo mira el rol y nada compara `req.user.restaurantId` con `:restaurantId` (`routes/dish.routes.ts:14-18`, `routes/ingredient.routes.ts:14-18`).
- `PUT /restaurants/A/dishes/<id de un plato de B>` modifica ese plato. `DishController.update` y `delete` usan solo `req.params.id`, y los repositorios filtran por `WHERE id = ?`.
- Cualquier usuario autenticado, incluido un `cliente` recién registrado, puede llamar a `GET /orders/active?restaurantId=X`, `GET /orders/:id` y `PATCH /orders/:orderId/items/:itemId/status` (`routes/order.routes.ts:14-18` solo usa `authenticate`).
- Si falta `JWT_SECRET`, se firma con `'super-secret-resttek-key'`, duplicado en `middlewares.ts:4` y `BcryptAuthService.ts:5`.
- `/auth/login` y `/auth/register` no tienen límite de intentos. `POST /orders` con `quantity` enorme genera ese número de filas en un bucle (`order.service.ts:27-37`).
- `app.use(cors())` permite cualquier origen, no hay helmet, y los controladores de pedidos devuelven `error.message` sin filtrar.
- Los tokens duran 8 h, no se pueden revocar y no hay logging de seguridad.

**Comportamiento esperado:** cada usuario solo accede a los datos de su restaurante (el cliente, solo a sus pedidos). La API no arranca sin `JWT_SECRET`. Los intentos de login están limitados. Los errores internos no se filtran. Hay refresh token con revocación.

## 2. Alcance

**Incluye**

- Fase 1: `JWT_SECRET` obligatorio y centralizado, `authorizeRestaurant`, IDOR en platos e ingredientes, autorización y propiedad en pedidos, rate limiting en auth.
- Fase 2: validación de pedidos, mapeo de errores, helmet/CORS/límite de body, tope de `limit` en empleados, política de contraseñas, normalización de email, igualar tiempos de login, refresh token con revocación en BD.
- Fase 3: dependencias vulnerables (T14), logging de seguridad, `.gitignore`, validación del esquema de `logoUrl`, documentación (T15).

**No incluye**

- Cambios en `web-empleados`, `web-clientes`, `web-admin` y `web-shared`. Quedan en un plan aparte: T11 a T13 del documento de contexto.
- Cerrar el registro público de clientes (decisión del usuario: se mantiene público de momento).
- Ocultar si un email existe en `/auth/register`. Sin verificación por email no se puede hacer sin romper el flujo. Se acepta como riesgo residual mitigado con rate limiting (ver sección 8).
- Endpoints para editar o eliminar empleados. Hoy no existen (`employee.routes.ts` solo tiene `POST /`, `GET /` y `GET /:id`).

## 3. Análisis del código actual

- **Auth y middlewares:** `contexts/shared/infrastructure/http/middlewares.ts`. `authenticate` hace `jwt.verify(token, JWT_SECRET)` sin fijar algoritmo, y `req.user` es `any`. El payload del token es `{ id, role, restaurantId }`, firmado en `LoginUseCase` y `RegisterClientUseCase` vía `IAuthService.generateToken`. El admin y el cliente tienen `restaurantId: null`.
- **Roles válidos:** `admin`, `manager`, `camarero`, `cocinero`, `cliente` (`Role.ts`).
- **Rutas con `:restaurantId`:** `dish.routes.ts` e `ingredient.routes.ts` usan `Router({ mergeParams: true })`. `restaurant-employee.routes.ts` es solo `admin`, así que `authorizeRestaurant` no le aporta nada (el admin lo salta).
- **IDOR:** `DishService.update/delete/findById` e `IngredientService.update/delete/findById` reciben solo `id`. Los controladores no pasan `restaurantId`.
- **Pedidos:** `OrderController` captura todo con `try/catch`, y devuelve `error.message` con 400 en `createOrder` y 400 en `updateItemStatus`. `OrderService` no valida `items`. `findActiveByRestaurant(restaurantId)` usa el `restaurantId` de la query tal cual. `/orders/mine` ya filtra por `user.id`.
- **Errores:** `errorHandler.ts` mapea 404 por nombre (`NOT_FOUND_ERRORS`) y 401 (`InvalidCredentialsError`). El resto de `AppError` es 400 y el resto de errores, 500 genérico. `OrderNotFoundError` no está en la lista de 404.
- **Base de datos:** migraciones en código en `config/database.ts` (`runInitialMigrations`, sentencias `CREATE TABLE IF NOT EXISTS` separadas por `;`). Con `NODE_ENV=test` usa `:memory:`.
- **Tests:** Vitest con `globals: true` y `vite-tsconfig-paths`. `supertest` y `@types/supertest` ya están en `devDependencies`, pero ningún test los usa todavía. Los mocks de repositorios están en `repositories/mocks/` (existen los de Ingredient, Order y Restaurant, pero **no** de Dish) y en `contexts/employee/application/mocks/MockDependencies.ts`.
- **Dependencias:** `dotenv` está en `package.json`, pero no se importa en ningún sitio, así que `.env` no se carga hoy.
- **Repositorio git:** no hay commits ni rama `development`, y tampoco `.gitignore` (ver sección 8).

## 4. Diseño de la solución

### 4.1 JWT centralizado
- Nuevo `src/config/jwt.ts`: `getJwtSecret()` lee `process.env.JWT_SECRET` y lanza `Error('JWT_SECRET no está definido')` si falta. Con `NODE_ENV=test` devuelve `'test-secret'`. Exporta `JWT_ALGORITHM = 'HS256'` y `getAccessTokenExpiresIn()` (`process.env.JWT_EXPIRES_IN ?? '15m'`).
- `authenticate` usa `jwt.verify(token, secret, { algorithms: ['HS256'] })` y valida que el payload tenga `id` (string) y `role` (uno de los roles válidos). `req.user` pasa a tipo `AuthUser { id: string; role: string; restaurantId: string | null }`.
- `server.ts` carga `dotenv/config` y llama a `getJwtSecret()` antes de `listen`, para fallar al arrancar. Se añade `.env.example` en `packages/api/`.

### 4.2 Aislamiento por restaurante
- `authorizeRestaurant(req, res, next)` en `middlewares.ts`: si `req.user.role === 'admin'` pasa. Si no, exige `req.user.restaurantId === req.params.restaurantId`. Si no, `403 { error: 'Forbidden: Insufficient permissions' }`, igual que `authorize`. Se aplica **después** de `authorize` en todas las rutas de `dish.routes.ts` e `ingredient.routes.ts`.
- Los métodos de servicio pasan a recibir `restaurantId`: `findById(restaurantId, id)`, `update(restaurantId, id, dto)` y `delete(restaurantId, id)`. Si el recurso no existe **o** pertenece a otro restaurante, lanzan `DishNotFoundError` / `IngredientNotFoundError` (404, sin revelar que existe). No se tocan los repositorios: la comprobación se hace en el servicio con `resource.restaurantId`.

### 4.3 Pedidos
- Nuevo tipo `OrderRequester { id, role, restaurantId }` en `order.service.ts`. Reglas:

| Ruta | Roles (`authorize`) | Comprobación adicional |
|---|---|---|
| `POST /orders` | `admin`, `manager`, `camarero`, `cliente` | Un empleado no admin solo puede crear en su `restaurantId` (Fase 2, T32) |
| `GET /orders/active` | `admin`, `manager`, `camarero`, `cocinero` | El `restaurantId` sale del token; solo el admin puede usar el de la query |
| `GET /orders/mine` | solo `authenticate` (ya filtra por `user.id`) | Ninguna |
| `GET /orders/:id` | solo `authenticate` | Admin: cualquiera. Empleado: pedido de su restaurante. Cliente: `order.clientId === user.id`. Si no, `OrderNotFoundError` (404) |
| `PATCH /orders/:orderId/items/:itemId/status` | `admin`, `manager`, `camarero`, `cocinero` | Pedido de su restaurante (admin, cualquiera). Si no, 404 |

- `OrderController` deja de capturar errores a mano: pasa a `next(error)` y el `errorHandler` central responde. `OrderNotFoundError` se añade a `NOT_FOUND_ERRORS`. Así `getById` y `updateItemStatus` devuelven 404 y los errores inesperados un 500 genérico.

### 4.4 Rate limiting
- Dependencia nueva, justificada: `express-rate-limit`. Fábrica `createAuthRateLimiters(options?)` en `contexts/shared/infrastructure/http/rateLimit.ts`:
  - login: 10 intentos / 15 min por IP + email.
  - register: 5 / hora por IP.
  - Responde `429 { error: 'TooManyRequests', message: 'Demasiados intentos, inténtalo más tarde' }`.
  - Los límites se leen de variables de entorno con valores por defecto, para poder bajarlos en los tests.
- El seed aborta si `NODE_ENV=production`.

### 4.5 Validación de pedidos
- `OrderService` recibe también un `DishRepository`. Reglas de `create`:
  - `items` debe ser un array no vacío con ≤ 50 elementos.
  - `quantity` entero entre 1 y 50.
  - `dishId` string.
  - `notes` string de ≤ 255 caracteres, o `null`.
  - El plato debe existir, tener `available` y cumplir `dish.restaurantId === request.restaurantId`. Eso demuestra a la vez que el restaurante existe.
- Nuevos errores en `DomainErrors.ts` (400): `InvalidOrderItemsError`, `InvalidQuantityError`, `DishNotAvailableError`.

### 4.6 Configuración HTTP
- `helmet()`, `cors({ origin })` con orígenes de `CORS_ORIGINS` (lista separada por comas; por defecto `http://localhost:4200,http://localhost:4201,http://localhost:4202`) y `express.json({ limit: '100kb' })`.
- `listEmployees`: `limit` acotado a 1..100 y `offset` ≥ 0.

### 4.7 Credenciales
- Nuevo `Password.ts` en `contexts/employee/domain/value-objects/`: debe ser string, de 12 a 72 bytes. Lanza `WeakPasswordError` (400). Se usa en `RegisterClientUseCase` y `CreateEmployeeUseCase`. El login **no** aplica la política (permite entrar a cuentas antiguas).
- `Email`: `trim()` + `toLowerCase()`. `SqliteEmployeeRepository.findByEmail` normaliza el parámetro. Migración: `UPDATE employees SET email = lower(trim(email))`.
- `LoginUseCase`: si no existe el usuario, ejecuta `comparePasswords` contra un hash bcrypt constante, para igualar tiempos.
- `Role.ts`: el mensaje de `InvalidRoleError` ya no lista los roles válidos.

### 4.8 Refresh token con revocación (decisión del usuario)
- Access token de 15 min (`JWT_EXPIRES_IN`). Refresh token opaco: `crypto.randomBytes(32).toString('base64url')`. En BD solo se guarda su hash SHA-256.
- Tabla nueva en la migración de `config/database.ts`:

```sql
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    family_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(employee_id) REFERENCES employees(id)
)
```

- Hexagonal en `contexts/employee/`: puerto `IRefreshTokenRepository` (`domain/`), implementación `SqliteRefreshTokenRepository` e `IAuthService.generateRefreshToken()` / `hashRefreshToken()` (`infrastructure/`), casos de uso `RefreshTokenUseCase` y `LogoutUseCase` (`application/`).
- `LoginUseCase` y `RegisterClientUseCase` devuelven además `refreshToken` (cambio compatible: solo se añade un campo).
- `POST /auth/refresh` con `{ refreshToken }`:
  - Si es válido, no está revocado y no ha expirado, lo revoca, emite uno nuevo en la misma familia y un access token **recargando el rol y el `restaurantId` desde la BD**.
  - Si el token ya estaba revocado (reutilización), revoca toda la familia y responde 401.
  - Respuesta: `{ token, refreshToken }`.
- `POST /auth/logout` con `{ refreshToken }` revoca el token. Responde 204.
- Caducidad del refresh token: 7 días.
- `revokeAllByEmployee(employeeId)` queda disponible en el repositorio para cuando existan los endpoints de editar o eliminar empleados.

### 4.9 Logging y limpieza
- No se añade `pino`: un módulo mínimo `config/logger.ts` que escribe JSON por consola (`level`, `event`, `ts` y campos útiles). Nunca registra contraseñas ni tokens.
- Eventos: `auth.login.success`, `auth.login.failure`, `auth.denied` (401/403 en middlewares) y `error.unhandled` (500 en `errorHandler`).
- `.gitignore` en la raíz: `node_modules`, `dist`, `*.db`, `.env*` (salvo `.env.example`), `.DS_Store`.
- `logoUrl` del restaurante: solo se acepta `http:` o `https:`.

**Alternativas descartadas:** meter `restaurant_id` en los `WHERE` de los repositorios (cambia las interfaces y los mocks; la comprobación en el servicio es suficiente); cookies HttpOnly (el usuario eligió Bearer + refresh).

## 5. Lista de tareas

Cada tarea tiene su test o verificación asociada (TDD: primero el test que falla). Los tests de rutas usan `supertest` con `NODE_ENV=test`.

### Fase 1 — Crítico / alto

**JWT (A02)**

- [x] **T1** (~5 min) — Crear `getJwtSecret()`, `JWT_ALGORITHM` y `getAccessTokenExpiresIn()`; lanza si falta `JWT_SECRET` (valor fijo en `NODE_ENV=test`) — `packages/api/src/config/jwt.ts` y `jwt.test.ts`
- [x] **T2** (~10 min) — `authenticate`: verificar con `algorithms: ['HS256']`, validar forma del payload y tipar `req.user` como `AuthUser` en lugar de `any` — `packages/api/src/contexts/shared/infrastructure/http/middlewares.ts` y `middlewares.test.ts`
- [x] **T3** (~5 min) — `BcryptAuthService.generateToken`: usar `getJwtSecret()`, `JWT_ALGORITHM` y `getAccessTokenExpiresIn()` (un único origen del secreto) — `packages/api/src/contexts/employee/infrastructure/BcryptAuthService.ts`
- [x] **T4** (~5 min) — `server.ts`: importar `dotenv/config`, llamar a `getJwtSecret()` antes de `listen` y crear `.env.example` con `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGINS` — `packages/api/src/server.ts`, `packages/api/.env.example`

**Aislamiento por restaurante (A01)**

- [x] **T5** (~10 min) — Crear el helper de tests HTTP: inicializar `dbConfig` en `beforeAll`, `tokenFor({ role, restaurantId })` firmando con `getJwtSecret()` y semillas mínimas de dos restaurantes (A y B) — `packages/api/src/test/http-helpers.ts`
- [x] **T6** (~10 min) — Middleware `authorizeRestaurant` (admin pasa; resto exige `restaurantId` del token igual a `:restaurantId`; si no, 403) con tests unitarios — `packages/api/src/contexts/shared/infrastructure/http/middlewares.ts`
- [x] **T7** (~5 min) — Aplicar `authorizeRestaurant` a las cinco rutas de platos — `packages/api/src/routes/dish.routes.ts`
- [x] **T8** (~5 min) — Aplicar `authorizeRestaurant` a las cinco rutas de ingredientes — `packages/api/src/routes/ingredient.routes.ts`
- [x] **T9** (~10 min) — Test HTTP cruzado: manager de A recibe 403 en `GET/POST/PUT/DELETE` de platos e ingredientes de B, y admin y manager de A siguen funcionando — `packages/api/src/routes/restaurant-isolation.test.ts`

**IDOR en platos e ingredientes (A01)**

- [ ] **T10** (~10 min) — `DishService`: `findById(restaurantId, id)`, `update(restaurantId, id, input)` y `delete(restaurantId, id)` lanzan `DishNotFoundError` si el plato es de otro restaurante; test unitario con `MockDishRepository` — `packages/api/src/services/dish.service.ts`, `dish.service.test.ts`
- [ ] **T11** (~5 min) — Crear `MockDishRepository` (mapa en memoria) en la carpeta de mocks — `packages/api/src/repositories/mocks/MockDishRepository.ts`
- [ ] **T12** (~5 min) — `DishController`: pasar `req.params.restaurantId` a `getById`, `update` y `delete` — `packages/api/src/controllers/dish.controller.ts`
- [ ] **T13** (~10 min) — `IngredientService`: `findById`, `update` y `delete` reciben `restaurantId` y lanzan `IngredientNotFoundError` si no coincide; adaptar `ingredient.service.test.ts` — `packages/api/src/services/ingredient.service.ts`
- [ ] **T14** (~5 min) — `IngredientController`: pasar `req.params.restaurantId` a `getById`, `update` y `delete` — `packages/api/src/controllers/ingredient.controller.ts`
- [ ] **T15** (~5 min) — Test HTTP: admin y manager de A reciben 404 al hacer `PUT` o `DELETE` de un plato o ingrediente de B usando la ruta `/restaurants/A/...` — `packages/api/src/routes/restaurant-isolation.test.ts`

**Pedidos (A01)**

- [ ] **T16** (~5 min) — Añadir `OrderNotFoundError` a `NOT_FOUND_ERRORS` para que responda 404; test del `errorHandler` — `packages/api/src/contexts/shared/infrastructure/http/errorHandler.ts`
- [ ] **T17** (~10 min) — `OrderService.getById(orderId, requester)`: admin cualquiera, empleado solo su restaurante, cliente solo si `clientId === requester.id`; si no, `OrderNotFoundError` — `packages/api/src/services/order.service.ts`, `order.service.test.ts`
- [ ] **T18** (~10 min) — `OrderService.updateItemStatus(orderId, itemId, status, requester)`: comprobar el restaurante del pedido contra el del token (admin exento) — `packages/api/src/services/order.service.ts`, `order.service.test.ts`
- [ ] **T19** (~5 min) — `OrderController.getActiveOrders`: el `restaurantId` sale de `req.user` para los roles no admin; solo el admin usa el de la query (400 si el admin no lo envía) — `packages/api/src/controllers/order.controller.ts`
- [ ] **T20** (~10 min) — `OrderController`: eliminar los `try/catch` que devuelven `error.message`, usar `next(error)`, pasar `requester` desde `req.user` en `getById` y `updateItemStatus` — `packages/api/src/controllers/order.controller.ts`
- [ ] **T21** (~5 min) — `order.routes.ts`: añadir `authorize` por ruta según la tabla de 4.3 (`POST`, `GET /active` y `PATCH`) — `packages/api/src/routes/order.routes.ts`
- [ ] **T22** (~10 min) — Tests HTTP: un cliente recibe 403 en `GET /orders/active` y en el `PATCH`; recibe 404 en `GET /orders/:id` de un pedido ajeno; un empleado de B no ve pedidos de A — `packages/api/src/routes/order.routes.test.ts`

**Rate limiting (A07)**

- [x] **T23** (~5 min) — Instalar `express-rate-limit` como dependencia de `@resttek/api` — `packages/api/package.json`
- [x] **T24** (~10 min) — Fábrica `createAuthRateLimiters(options?)` con límites de login (IP + email) y register, 429 con mensaje en español y límites leídos de variables de entorno — `packages/api/src/contexts/shared/infrastructure/http/rateLimit.ts`
- [x] **T25** (~5 min) — Aplicar los limitadores a `POST /login` y `POST /register` — `packages/api/src/contexts/employee/infrastructure/http/auth.routes.ts`
- [x] **T26** (~10 min) — Test HTTP: el intento N+1 de login devuelve 429; una IP o email distintos no se ven afectados — `packages/api/src/contexts/employee/infrastructure/http/auth.routes.test.ts`
- [ ] **T27** (~5 min) — `seed.ts`: abortar con mensaje claro si `NODE_ENV === 'production'` — `packages/api/src/scripts/seed.ts`

### Fase 2 — Medio

**Validación de pedidos (A04/A08)**

- [ ] **T28** (~5 min) — Añadir `InvalidOrderItemsError`, `InvalidQuantityError` y `DishNotAvailableError` — `packages/api/src/errors/DomainErrors.ts`
- [ ] **T29** (~10 min) — `OrderService.create`: validar `items` (array, 1..50), `quantity` (entero 1..50), `dishId` y `notes`; test con `quantity` enorme, negativa y decimal — `packages/api/src/services/order.service.ts`, `order.service.test.ts`
- [ ] **T30** (~10 min) — `OrderService` recibe `DishRepository`; verificar que cada plato existe, está `available` y es del `restaurantId` del pedido; tests con plato ajeno y no disponible — `packages/api/src/services/order.service.ts`
- [ ] **T31** (~5 min) — Componer `DishRepository` en `OrderService` y adaptar `order.service.test.ts` al nuevo constructor — `packages/api/src/routes/order.routes.ts`
- [ ] **T32** (~5 min) — `createOrder`: un empleado no admin solo crea pedidos en su `restaurantId` (si no, 403 vía `requester`) — `packages/api/src/services/order.service.ts`, `order.service.test.ts`

**Configuración HTTP (A05)**

- [ ] **T33** (~5 min) — Instalar `helmet` — `packages/api/package.json`
- [ ] **T34** (~10 min) — `app.ts`: `helmet()`, `cors` con orígenes de `CORS_ORIGINS` y `express.json({ limit: '100kb' })`; test de las cabeceras y de que un origen no permitido no recibe `Access-Control-Allow-Origin` — `packages/api/src/app.ts`, `packages/api/src/app.test.ts`
- [ ] **T35** (~10 min) — `EmployeeController.listEmployees`: acotar `limit` a 1..100 y `offset` ≥ 0 (leer primero el controlador); test — `packages/api/src/contexts/employee/infrastructure/http/EmployeeController.ts`

**Credenciales y cuentas (A07)**

- [ ] **T36** (~5 min) — Añadir `WeakPasswordError` (400) — `packages/api/src/errors/DomainErrors.ts`
- [ ] **T37** (~10 min) — Value object `Password`: string, 12 a 72 bytes; tests de límites — `packages/api/src/contexts/employee/domain/value-objects/Password.ts`, `Password.test.ts`
- [ ] **T38** (~10 min) — Aplicar `Password` en `RegisterClientUseCase` y `CreateEmployeeUseCase`; actualizar las contraseñas de los tests existentes — `packages/api/src/contexts/employee/application/RegisterClientUseCase.ts`, `CreateEmployeeUseCase.ts`
- [ ] **T39** (~5 min) — `Email`: `trim()` + `toLowerCase()`; test de que `Admin@X.com` y `admin@x.com` dan el mismo valor — `packages/api/src/contexts/shared/domain/value-objects/Email.ts`
- [ ] **T40** (~5 min) — `SqliteEmployeeRepository.findByEmail`: normalizar el parámetro; test con mayúsculas — `packages/api/src/contexts/employee/infrastructure/SqliteEmployeeRepository.ts`
- [ ] **T41** (~5 min) — Migración `UPDATE employees SET email = lower(trim(email))` al inicializar la BD — `packages/api/src/config/database.ts`
- [ ] **T42** (~10 min) — `LoginUseCase`: si el usuario no existe, ejecutar `comparePasswords` contra un hash bcrypt constante antes de lanzar `InvalidCredentialsError`; test de que se invoca la comparación — `packages/api/src/contexts/employee/application/LoginUseCase.ts`
- [ ] **T43** (~5 min) — `Role.ts`: el mensaje de `InvalidRoleError` ya no lista los roles válidos; actualizar `Role.test.ts` — `packages/api/src/contexts/employee/domain/value-objects/Role.ts`

**Refresh token con revocación (A02/A07)**

- [ ] **T44** (~5 min) — Migración de la tabla `refresh_tokens` (esquema de 4.8) — `packages/api/src/config/database.ts`
- [ ] **T45** (~10 min) — Puerto `IRefreshTokenRepository` (`save`, `findByHash`, `revoke`, `revokeFamily`, `revokeAllByEmployee`) y su mock en memoria — `packages/api/src/contexts/employee/domain/IRefreshTokenRepository.ts`, `application/mocks/MockDependencies.ts`
- [ ] **T46** (~10 min) — `SqliteRefreshTokenRepository` con test contra `:memory:` — `packages/api/src/contexts/employee/infrastructure/SqliteRefreshTokenRepository.ts`, `SqliteRefreshTokenRepository.test.ts`
- [ ] **T47** (~10 min) — `IAuthService.generateRefreshToken()` y `hashRefreshToken()` (random 32 bytes + SHA-256) en `BcryptAuthService` y en `MockAuthService` — `packages/api/src/contexts/employee/domain/IAuthService.ts`, `infrastructure/BcryptAuthService.ts`
- [ ] **T48** (~10 min) — `LoginUseCase` y `RegisterClientUseCase`: emitir y guardar un refresh token (nueva familia) y devolverlo como `refreshToken`; adaptar los tests — `packages/api/src/contexts/employee/application/LoginUseCase.ts`, `RegisterClientUseCase.ts`
- [ ] **T49** (~10 min) — `RefreshTokenUseCase`: rotar, recargar rol y `restaurantId` desde la BD, rechazar si el empleado ya no existe — `packages/api/src/contexts/employee/application/RefreshTokenUseCase.ts`
- [ ] **T50** (~10 min) — `RefreshTokenUseCase`: detección de reutilización (revoca la familia y lanza `InvalidCredentialsError`); tests de token expirado, revocado y reutilizado — `packages/api/src/contexts/employee/application/RefreshTokenUseCase.ts`
- [ ] **T51** (~5 min) — `LogoutUseCase` (revoca el refresh token; idempotente) con test — `packages/api/src/contexts/employee/application/LogoutUseCase.ts`
- [ ] **T52** (~10 min) — `AuthController.refresh` y `logout`, cableado en `dependencies.ts` y rutas `POST /auth/refresh` y `POST /auth/logout` (204) — `packages/api/src/contexts/employee/infrastructure/http/AuthController.ts`, `dependencies.ts`, `auth.routes.ts`
- [ ] **T53** (~10 min) — Test HTTP del ciclo completo: login → refresh → reutilizar el viejo (401) → el nuevo ya está revocado; logout invalida el refresh — `packages/api/src/contexts/employee/infrastructure/http/auth.routes.test.ts`

### Fase 3 — Transversal API

**Dependencias (A06)**

- [ ] **T54** (~5 min) — Registrar la línea base: `npm audit` en la raíz y `npm audit --omit=dev`; anotar en la sección 8 cuáles afectan a la API en ejecución — `docs/plans/2026-10-21-fix-vulnerabilidades-owasp-api.md`
- [ ] **T55** (~10 min) — `npm audit fix` sin `--force`; ejecutar `npm test` — `package.json`, `package-lock.json`
- [ ] **T56** (~10 min) — Comprobar que los tres frontends siguen compilando tras la actualización (`npm run build -w @resttek/web-admin`, `@resttek/web-empleados` y `@resttek/web-clientes`) — `package-lock.json`

**Logging y limpieza (A09)**

- [ ] **T57** (~5 min) — Logger JSON mínimo (`info`, `warn`, `error`) que no admite campos `password` ni `token` — `packages/api/src/config/logger.ts`, `logger.test.ts`
- [ ] **T58** (~10 min) — Registrar `auth.denied` en `authenticate` / `authorize` / `authorizeRestaurant` y `auth.login.success|failure` en `AuthController.login` — `packages/api/src/contexts/shared/infrastructure/http/middlewares.ts`, `AuthController.ts`
- [ ] **T59** (~5 min) — `errorHandler`: registrar con `logger.error` los errores inesperados (500) sin cambiar la respuesta — `packages/api/src/contexts/shared/infrastructure/http/errorHandler.ts`
- [ ] **T60** (~5 min) — Crear `.gitignore` en la raíz (`node_modules`, `dist`, `*.db`, `.env*` salvo `.env.example`, `.DS_Store`) — `.gitignore`
- [ ] **T61** (~10 min) — Validar que `logoUrl` del restaurante es `http:` o `https:` (leer antes `restaurant.service.ts`); error 400 y tests — `packages/api/src/services/restaurant.service.ts`, `restaurant.service.test.ts`

**Verificación y documentación**

- [ ] **T62** (~10 min) — Verificación manual con `curl` (sección 6) contra `npm run dev:api`, con `JWT_SECRET` definido — (sin archivos)
- [ ] **T63** (~10 min) — Ejecutar toda la suite (`npm test`) y comprobar que no hay regresiones — (sin archivos)
- [ ] **T64** (~10 min) — Documentar la autorización por restaurante, la tabla de roles de pedidos, las variables de entorno y los endpoints de refresh y logout — `docs/arquitectura/arquitectura-api.md`, `CLAUDE.md`

## 6. Plan de pruebas

El proyecto sí tiene framework de tests (Vitest) y `supertest`. Cada tarea lleva su test, escrito antes del código.

**Verificación manual con `curl`** (API en :3000 con `JWT_SECRET=dev-secret npm run dev:api`; tokens obtenidos con `POST /api/v1/auth/login` tras `npm run seed`):

| Petición | Resultado esperado |
|---|---|
| Arrancar sin `JWT_SECRET` (y sin `NODE_ENV=test`) | Falla al iniciar con `JWT_SECRET no está definido` |
| `POST /restaurants/B/dishes` con token de un manager de A | `403` |
| `PUT /restaurants/A/dishes/<id de un plato de B>` con token de un manager de A | `404` |
| `GET /orders/active?restaurantId=B` con token de un cocinero de A | `200` con pedidos **de A**, no de B |
| `GET /orders/active` con token de un cliente | `403` |
| `GET /orders/<pedido ajeno>` con token de un cliente | `404` |
| `PATCH /orders/<id>/items/<id>/status` con token de un cliente | `403` |
| 11 `POST /auth/login` seguidos con el mismo email | El 11.º responde `429` |
| `POST /orders` con `quantity: 1000000` | `400`, sin crear filas |
| `POST /auth/register` con password `abc` | `400` |
| `POST /auth/refresh` con un refresh token ya usado | `401`, y el siguiente refresh de esa familia también `401` |

**Casos límite:** el admin con `restaurantId: null` sigue accediendo a todo. `GET /orders/mine` y `/public/*` siguen funcionando. Un payload JWT sin `role` da 401. Un `Admin@X.com` ya existente se normaliza sin romper el login.

**Regresiones:** `npm test` completo en verde. Los tests existentes de servicios cambian de firma (T10, T13, T31) y se adaptan en la misma tarea.

## 7. Documentación a actualizar

- [ ] `docs/arquitectura/arquitectura-api.md`: tabla de endpoints y roles (pedidos), `authorizeRestaurant`, refresh y logout, política de contraseñas.
- [ ] `CLAUDE.md`: variables de entorno (`JWT_SECRET` obligatoria, `JWT_EXPIRES_IN`, `CORS_ORIGINS`) y el uso de `src/test/http-helpers.ts`.
- [ ] `docs/dominio/modelo-datos.md`: tabla `refresh_tokens`.
- [ ] `docs/plans/correccion-vulnerabilidades-owasp.md`: marcar qué tareas quedan cubiertas por este plan.

## 8. Riesgos y dudas abiertas

- **Compatibilidad con los frontends (importante):** al pasar el access token a 15 min (T3), los frontends actuales cerrarán la sesión a los 15 min porque aún no usan `/auth/refresh`. Hay que desplegar T44 a T53 junto con el plan de frontend (T12), o fijar temporalmente `JWT_EXPIRES_IN=8h`.
- **Cambios incompatibles de contrato:** `GET /orders/active` ignora el `restaurantId` de la query para roles no admin; `POST /orders`, `GET /orders/active` y el `PATCH` pasan a exigir roles concretos; `GET/PUT/DELETE` de platos e ingredientes de otro restaurante pasan de funcionar a 403/404; `web-clientes` puede depender de `POST /orders` con un rol concreto (se asume `cliente`). Hay que probar con las tres apps.
- **Política de contraseñas:** el mínimo de 12 caracteres choca con el formulario de registro actual (6 caracteres en `web-shared`). Hasta actualizarlo, los registros desde el frontend fallarán con 400. También afecta a los tests existentes.
- **Normalización de emails (T41):** si en la BD hay dos cuentas que difieren solo en mayúsculas, el `UPDATE` romperá la restricción `UNIQUE`. Revisar los datos antes de desplegar.
- **Enumeración de emails en `/auth/register`:** se acepta como riesgo residual (mitigado con el rate limiting de T24). Quitarla exige verificación por email, fuera de este plan.
- **Repositorio sin commits:** `git branch -a` no devuelve ninguna rama, no hay `main`, `master` con commits ni `development`. `implement-plan` necesita crear `development` desde `main` o `master`: habrá que hacer antes un commit inicial (y T60, el `.gitignore`, conviene incluirlo primero).
- **Duda para el usuario:** número de ticket para el nombre de la rama de `implement-plan` (formato `fix/<ticket>-vulnerabilidades-owasp-api`).
- **Plan largo (64 tareas):** conviene implementarlo fase a fase, con `implement-plan` sobre cada fase y un commit por tarea.
- **Línea base de dependencias (T54):** `npm audit` en la raíz informa de 46 vulnerabilidades (5 críticas y 26 altas). Falta separar cuáles afectan a la API en ejecución, y la mayoría probablemente vienen de las dependencias de Angular y del tooling.
