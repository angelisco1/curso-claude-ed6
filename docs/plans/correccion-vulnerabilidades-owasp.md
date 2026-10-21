# Plan: corrección de vulnerabilidades OWASP Top 10 (API y web-empleados)

Origen: auditoría de solo lectura sobre `packages/api` y `packages/web-empleados` (+ `web-shared`), realizada el 2026-10-21. Los hallazgos están verificados leyendo el código; no se ha ejecutado ningún exploit.

Cada tarea debe seguir TDD (test que falla → corrección → test en verde) y llevar su propio commit. Orden por prioridad: primero lo que permite acceso indebido a datos o toma de control.

## Fase 1 — Crítico / alto (API)

### T1. Secreto JWT obligatorio y centralizado (A02)
- Crear un módulo único de configuración (p. ej. `config/jwt.ts`) que lea `JWT_SECRET` y lance error al arrancar si falta (en `NODE_ENV=test` usar un valor fijo de test).
- Sustituir el `process.env.JWT_SECRET || 'super-secret-resttek-key'` duplicado en `contexts/shared/infrastructure/http/middlewares.ts:4` y `contexts/employee/infrastructure/BcryptAuthService.ts:5`.
- Fijar `algorithms: ['HS256']` en `jwt.sign` y `jwt.verify`; validar la forma del payload (`id`, `role`, `restaurantId`) y tipar `req.user` en lugar de `any`.
- Tests: arranque falla sin secreto; token firmado con otro algoritmo o payload malformado → 401.

### T2. Aislamiento por restaurante (A01)
- Nuevo middleware `authorizeRestaurant` (en `middlewares.ts`): exige `req.user.restaurantId === req.params.restaurantId`, salvo rol `admin`.
- Aplicarlo en `routes/dish.routes.ts:14-18`, `routes/ingredient.routes.ts:14-18` y `contexts/employee/infrastructure/http/restaurant-employee.routes.ts:7`.
- Tests: un manager/cocinero del restaurante A recibe 403 sobre el restaurante B; el admin sigue pudiendo.

### T3. Corregir IDOR en platos e ingredientes (A01)
- En `dish.service.ts` / `ingredient.service.ts` (y controladores `getById`, `update`, `delete`) verificar que el recurso pertenece al `:restaurantId` de la ruta, o filtrar en repositorio con `WHERE id = ? AND restaurant_id = ?`. Devolver 404 si no coincide.
- Tests por cada operación con un recurso de otro restaurante.

### T4. Autorización y propiedad en pedidos (A01)
- `routes/order.routes.ts:14-18`: añadir `authorize([...])` por ruta:
  - `POST /orders`: cliente (y camarero).
  - `GET /orders/active`: camarero, cocinero, manager, admin; forzar el `restaurantId` del token (ignorar el de la query salvo admin).
  - `GET /orders/:id`: personal del mismo restaurante, o el cliente propietario.
  - `PATCH .../items/:itemId/status`: camarero, cocinero, manager, admin del mismo restaurante. Un `cliente` no.
- Comprobar en el servicio que el pedido pertenece al restaurante del token.
- Tests: cliente no puede leer pedidos ajenos ni cambiar estados; empleado de otro restaurante recibe 403/404.

### T5. Rate limiting en autenticación (A07)
- Añadir `express-rate-limit` a `/auth/login` y `/auth/register` (`auth.routes.ts:6-7`), con límite más estricto por IP+email en login.
- Documentar que `npm run seed` (contraseña = email) no debe ejecutarse en producción; hacer que el seed aborte si `NODE_ENV=production`.
- Test: tras N intentos fallidos → 429.

## Fase 2 — Medio (API)

### T6. Validación de entrada en pedidos (A04/A08)
- En `services/order.service.ts:108-123`: validar que `items` es array no vacío con tope (p. ej. ≤ 50), `quantity` entero 1..50, `dishId` string; cargar el plato y verificar que existe, `available` y pertenece al restaurante del pedido. Verificar que el restaurante existe.
- Tests con `quantity` enorme, negativa, decimal, plato de otro restaurante y plato no disponible.

### T7. Manejo de errores homogéneo (A05)
- `controllers/order.controller.ts:20-22` (y similares): delegar en `errorHandler` central; devolver solo mensajes de `AppError`, 500 genérico para el resto. Registrar el error real en el log.
- Test: un error SQL/TypeError no filtra su mensaje.

### T8. Cabeceras, CORS y límites (A05)
- `app.ts`: añadir `helmet`, `cors({ origin: [orígenes de los frontends desde variable de entorno] })` y `express.json({ limit: '100kb' })` explícito.
- Tope máximo a `limit`/`offset` en `listEmployees` (`EmployeeController.ts:38-39`).

### T9. Credenciales y cuentas (A07)
- Política de contraseñas en `RegisterClientUseCase` y `CreateEmployeeUseCase`: tipo string, mínimo 12 caracteres, máximo 72 bytes (límite de bcrypt).
- `Email` (`contexts/shared`): `trim` + minúsculas y regex más estricta; migración para normalizar emails existentes.
- Login: ejecutar un `compare` de bcrypt ficticio cuando el usuario no existe (igualar tiempos).
- Register: respuesta que no revele si el email existe (mensaje genérico o flujo por email); acotar el mensaje de `InvalidRoleError` (`Role.ts:17`).

### T10. Ciclo de vida del token (A02/A07)
- Decisión tomada: Bearer + refresh token con revocación en servidor.
- Access token de vida corta (15 min). Refresh token opaco y aleatorio, guardado hasheado en una tabla nueva `refresh_tokens` (usuario, hash, expiración, revocado, `replaced_by`), creada en la migración de `config/database.ts`.
- Endpoints: `POST /auth/refresh` (rota el refresh token: invalida el usado y emite uno nuevo; si se reutiliza uno ya rotado, se revoca toda la familia) y `POST /auth/logout` (revoca el refresh token).
- Revocar todos los refresh tokens de un usuario al cambiar su rol o eliminarlo.
- Tests: refresh válido rota; refresh reutilizado o revocado → 401 y revoca la familia; logout invalida el refresh; usuario eliminado no puede refrescar.

## Fase 3 — Frontend web-empleados / web-shared

### T11. Guards por rol (A01)
- Crear `roleGuard` en `web-shared` (lee `data.roles` de la ruta) y aplicarlo en `web-empleados/src/app/app.routes.ts:11-34` para `/cocina`, `/barra`, `/salon`. Redirigir a `defaultRoute` (`shell.component.ts:34-40`, hoy sin usar) cuando el rol no coincida.
- Recordar que es solo UX: la barrera real es T2–T4 en la API.

### T12. Sesión y token en cliente (A02/A07)
- `web-shared/src/lib/auth/auth.store.ts`: decodificar el JWT y validar `exp` en `isAuthenticated` y en `authGuard`; envolver `JSON.parse` en try/catch; no confiar en `auth_user` de `localStorage` (derivar rol del token o pedir `/me`).
- `auth.interceptor.ts`: adjuntar el `Bearer` solo a URLs que empiecen por la `API_URL`.
- `error.interceptor.ts`: gestionar 403 y eliminar la condición de carrera del flag `isRedirecting`.
- Decisión tomada: se mantiene el Bearer en `localStorage` (sin cookies ni CSRF). Como mitigación, CSP estricta (T13), access token de 15 min (T10) y no persistir el objeto de usuario.
- Interceptor: ante un 401, intentar `POST /auth/refresh` una sola vez (cola de peticiones en espera) y reintentar; si falla, cerrar sesión. Guardar el refresh token en `localStorage` junto al access token; `logout` debe llamar a `/auth/logout`.
- Subir el mínimo de contraseña de `register.component.ts:34` a 12.

### T13. Configuración y mensajes (A05/A09)
- `web-empleados/src/index.html`: definir CSP (o documentar la cabecera equivalente para el servidor que sirva los estáticos) y comprobar que la configuración `production` de `angular.json` no emite source maps.
- `order.store.ts:27,50`: mostrar un mensaje genérico en lugar de `err.message`; verificar que `stopPolling` se llama en `ngOnDestroy` y al hacer logout.

## Fase 4 — Transversal

### T14. Dependencias (A06)
- Ejecutar `npm audit` y `npm audit fix` en la raíz; subir Angular a la última 21.2.x parcheada (`@angular/core`, `common`, `router`, `compiler`, `platform-browser`, `forms`, `build`, `cli`), `vite` y `undici`. Revisar con `npm audit --omit=dev` por workspace qué afecta realmente a la API en ejecución.
- Verificar con `npm test` y `npm run build -w ...` de cada frontend tras actualizar.
- Estado actual: 46 vulnerabilidades (5 críticas, 26 altas, 10 moderadas, 5 bajas).

### T15. Logging de seguridad y higiene del repo (A09)
- Añadir logger (p. ej. pino) y registrar login fallido/correcto, 401/403, y operaciones administrativas; registrar los 500 en `errorHandler`.
- Crear `.gitignore` en la raíz (`node_modules`, `*.db`, `.env*`, `.DS_Store`, `dist`) para no commitear `resttek.db` ni secretos.
- Validar esquema `http(s)` en `logoUrl` del restaurante.

## Decisiones
1. Token: se mantiene Bearer en `localStorage` con refresh token y CSP estricta (decidido).
2. Refresh token con revocación en BD (decidido).
3. Registro público de clientes: se mantiene público de momento (decidido). T5 y T9 son imprescindibles. Revisar más adelante la alternativa de cerrarlo (alta por invitación o verificación de email).

## Criterio de aceptación
- `npm test` en verde, con tests nuevos para cada tarea de las fases 1–2.
- Un usuario de un restaurante o rol no puede leer ni modificar datos de otro (probado con tests de integración sobre las rutas).
- La API no arranca sin `JWT_SECRET`.
- `npm audit` sin vulnerabilidades críticas ni altas que afecten al código en ejecución.
- Documentar los cambios de seguridad relevantes en `docs/arquitectura/`.
