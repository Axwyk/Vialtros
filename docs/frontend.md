# Frontend — Vialtros

> **Última actualización:** 21 de mayo de 2026

## Estructura general

```text
frontend/src/
├── App.js                  # Raíz: router, auth state, navbar condicional
├── pages/                  # Páginas completas (vistas de React Router)
├── components/             # Componentes reutilizables
└── services/               # Lógica de comunicación con la API
```

---

## App.js

Gestiona el estado global de autenticación y las rutas de la SPA.

**Estado:**

- `isAuth` — `true` si existe un `access` token en `localStorage`
- `role` — rol del usuario (`admin`, `driver`, `user`), validado contra `/api/users/me/`

**Comportamiento al iniciar:**

1. Comprueba `localStorage.access`
2. Llama a `getCurrentUser()` → valida el token
3. Si el token es inválido → logout forzado + limpieza de `localStorage`

**Rutas registradas:**

| Path | Componente | Protegida |
| --- | --- | --- |
| `/login` | `LoginPage` | No |
| `/dashboard` | `DashboardPage` | Sí |
| `/tracking/:routeId` | `TrackingPage` | Sí |
| `/admin/users` | `AdminUsersPage` | Sí |
| `/admin/drivers` | `AdminDriversPage` | Sí |
| `/admin/routes` | `AdminRoutesPage` | Sí |
| `/` | Redirige a `/login` | — |

**Navbar:** Solo se renderiza cuando `isAuth === true`. Contiene el logo y el botón de cerrar sesión.

---

## Páginas

### LoginPage (`/login`)

Pantalla de autenticación con diseño split-screen SaaS.

**Estructura visual:**

```text
┌────────────────────────┬──────────────────────┐
│  Panel izquierdo       │  Panel derecho       │
│  (oculto en mobile)    │  (formulario)        │
│                        │                      │
│  Logo grande (80px)    │  Input usuario       │
│  "Vialtros"            │  Input contraseña    │
│  Copy de producto      │  Toggle ojo          │
│  Features con iconos   │  Botón ingresar      │
│  Hero: SVG abstracto   │  Chip de error       │
│  Gradiente azul        │  Fondo blanco        │
└────────────────────────┴──────────────────────┘
```

> No se usan emojis. Todos los iconos y decoraciones son SVG inline outline profesional.

**Estado local:**

- `username`, `password` — campos del formulario
- `showPassword` — activa/desactiva tipo `text` en el campo contraseña
- `loading` — muestra spinner en el botón mientras se hace el request
- `error` — mensaje de error mostrado en el chip rojo

**Flujo de login:**

1. `POST /api/token/` con `{ username, password }`
2. Guarda en `localStorage`: `access`, `refresh`, `role`, `username`
3. Llama a `onLogin()` → actualiza `isAuth` en `App.js`
4. React Router navega a `/dashboard`

**Iconografía:**

- Solo SVG inline outline profesional (estilo Lucide), sin dependencias externas ni emojis en todo el frontend.
- Ejemplo: `IconUser`, `IconLock`, `IconEye`, `IconEyeOff` (inputs y botones), y todos los features/hero.

---

### DashboardPage (`/dashboard`)

Panel principal tras el login.

**Componentes:**

- `StatCards` — tarjetas con métricas (rutas, usuarios, trackings activos)
- `HeroCard` — tarjeta de bienvenida con animación, saludo por hora del día
- `ActivityFeed` — feed lateral fijo (272px) con actividad reciente
- `MiniChart` — gráfica SVG semanal de actividad

**Saludo dinámico:** Basado en la hora actual (Buenos días / Buenas tardes / Buenas noches).

---

### TrackingPage (`/tracking/:routeId`)

Vista de seguimiento en tiempo real.

**Funcionalidad:**

- Conecta al WebSocket `ws://localhost:8000/ws/tracking/<routeId>/`
- Actualiza el mapa Leaflet con la posición recibida
- Usa `MapView.js` como componente del mapa

---

### AdminUsersPage (`/admin/users`)

CRUD completo de usuarios del sistema.

**Columnas de la tabla:** `#`, `Usuario`, `Email`, `Rol` (badge), `Activo` (badge), Acciones (editar/eliminar)

**Modal — campos del formulario:**

| Campo | Tipo | Requerido |
| --- | --- | --- |
| `username` | text | Sí |
| `email` | email | No |
| `role` | select: `admin / driver / user` | Sí |
| `password` | password / text | Sí (create) |
| Mostrar contraseña | checkbox | — |
| `is_active` | checkbox | — |

**Estado `showPassword`:** Resetea a `false` al abrir el modal (crear o editar).

---

### AdminDriversPage (`/admin/drivers`)

CRUD de conductores.

**Columnas de la tabla:** `#`, `Usuario`, `Email`, `Nº Licencia`, Acciones

**Modal — campos del formulario:**

| Campo | Tipo | Requerido |
| --- | --- | --- |
| `user` | select (rol=driver) | Sí |
| `license_number` | text | Sí |

> El selector de usuario filtra los usuarios con `role=driver` obtenidos de `/api/users/`.

---

### AdminRoutesPage (`/admin/routes`)

CRUD de rutas de transporte.

**Columnas de la tabla:** `#`, `Nombre`, `Origen`, `Destino`, `Conductor`, `Pasajeros` (badge), Acciones

**Modal — campos del formulario:**

| Campo | Tipo | Requerido |
| --- | --- | --- |
| `name` | text | Sí |
| `origin` | text | Sí |
| `destination` | text | Sí |
| `driver` | select (conductores) | No |

> Si no se selecciona conductor, el payload envía `driver: null`.

---

## Componentes

### `Modal.js`

Modal reutilizable para formularios de creación/edición.

**Props:**

- `isOpen` — controla la visibilidad
- `onClose` — callback para cerrar
- `title` — título del modal
- `children` — contenido del formulario

**Comportamiento:**

- Solo se cierra mediante el botón `×` o el botón "Cancelar" en el padre.
- **No se cierra** al hacer clic fuera ni con la tecla ESC.

---

### `Logo.js`

Componente SVG del logo de Vialtros.

**Exports:**

- `LogoIcon({ size, color })` — solo el icono SVG. Por defecto: `size=32`, `color="#1E40AF"`.
- `Logo({ variant, iconSize })` — icono + wordmark "Vialtros". Variantes:
  - `"default"` — icono azul, texto oscuro (para fondos claros)
  - `"light"` — icono y texto blancos (para la navbar oscura)

---

### `PrivateRoute.js`

Wrapper de `<Route>`. Si no hay `access` en `localStorage`, redirige a `/login`.

---

### `components/dashboard/`

Componentes específicos del Dashboard:

- `icons.js` — Colección de iconos SVG inline usados en el dashboard
- `StatCard` — Tarjeta de métrica (icono + valor + etiqueta)
- `HeroCard` — Tarjeta de bienvenida con animación
- `ActivityFeed` — Feed lateral de actividad reciente
- `MiniChart` — Gráfica SVG semanal

---

## Servicios

### `services/api.js`

Instancia de Axios configurada con la URL base de la API y un interceptor que añade el JWT a cada request.

```js
// Uso
import api from './services/api';
api.get('/users/').then(r => r.data);
```

**Variable de entorno requerida:** `REACT_APP_API_URL=http://localhost:8000/api`

---

### `services/auth.js`

```js
getCurrentUser() → Promise<User|null>
```

Llama a `GET /api/users/me/`. Devuelve el usuario o `null` si el token es inválido.

---

### `services/admin.js`

CRUD para las tres entidades administrables:

| Función | Endpoint |
| --- | --- |
| `getUsers()` | `GET /api/users/` |
| `getUser(id)` | `GET /api/users/{id}/` |
| `createUser(data)` | `POST /api/users/` |
| `updateUser(id, data)` | `PATCH /api/users/{id}/` |
| `deleteUser(id)` | `DELETE /api/users/{id}/` |
| `getDrivers()` | `GET /api/drivers/` |
| `getDriver(id)` | `GET /api/drivers/{id}/` |
| `createDriver(data)` | `POST /api/drivers/` |
| `updateDriver(id, data)` | `PATCH /api/drivers/{id}/` |
| `deleteDriver(id)` | `DELETE /api/drivers/{id}/` |
| `getRoutes()` | `GET /api/routes/` |
| `getRoute(id)` | `GET /api/routes/{id}/` |
| `createRoute(data)` | `POST /api/routes/` |
| `updateRoute(id, data)` | `PATCH /api/routes/{id}/` |
| `deleteRoute(id)` | `DELETE /api/routes/{id}/` |

---

### `services/ws.js`

```js
connectTrackingWS(routeId, onMessage) → WebSocket
```

Abre una conexión WebSocket a `ws://<REACT_APP_WS_URL>/tracking/<routeId>/` y llama a `onMessage(data)` con cada mensaje recibido.

**Variable de entorno requerida:** `REACT_APP_WS_URL=ws://localhost:8000/ws`

---

### `services/dashboard.js`

Funciones para obtener las estadísticas del dashboard desde la API.

---

## Variables de Entorno (Frontend)

Crear un archivo `.env` en `frontend/`:

```env
REACT_APP_API_URL=http://localhost:8000/api
REACT_APP_WS_URL=ws://localhost:8000/ws
```

Para producción:

```env
REACT_APP_API_URL=https://api.vialtros.com/api
REACT_APP_WS_URL=wss://api.vialtros.com/ws
```
