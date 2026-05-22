# Arquitectura del Sistema — Vialtros

> **Última actualización:** 21 de mayo de 2026

## Visión General

Vialtros es una plataforma SaaS de gestión de rutas con seguimiento en tiempo real. El sistema sigue una arquitectura cliente-servidor desacoplada:

- **Backend:** API REST + WebSocket (Python/Django)
- **Frontend:** SPA (React)
- **Comunicación HTTP:** Axios con JWT en cada request
- **Comunicación en tiempo real:** WebSocket nativo

```text
┌─────────────────────┐         REST (JWT)           ┌──────────────────────────┐
│                     │ ◄──────────────────────────► │                          │
│   React SPA         │                              │   Django REST Framework  │
│   (Puerto 3000)     │         WebSocket            │   (Puerto 8000 / Daphne) │
│                     │ ◄──────────────────────────► │                          │
└─────────────────────┘                              └────────────┬─────────────┘
                                                                  │
                                                         ┌────────▼──────────┐
                                                         │  SQLite (dev)     │
                                                         │  PostgreSQL (prod)│
                                                         └───────────────────┘
```

---

## Stack Tecnológico

### Backend

| Componente | Tecnología | Versión |
| --- | --- | --- |
| Framework web | Django | 6.x |
| API REST | Django REST Framework | latest |
| Autenticación | SimpleJWT | latest |
| WebSocket | Django Channels + Daphne | latest |
| Base de datos (dev) | SQLite | — |
| Base de datos (prod) | PostgreSQL | 14+ |
| Servidor ASGI | Daphne | latest |

### Frontend

| Componente | Tecnología | Versión |
| --- | --- | --- |
| Framework UI | React | 19 |
| Estilos | Tailwind CSS | 3 |
| Routing | React Router | v7 |
| Mapas | Leaflet + react-leaflet | latest |
| HTTP client | Axios | latest |
| Iconografía | SVG inline (sin dependencias) | — |

---

## Estructura de Directorios

```text
Vialtros/
├── backend/
│   ├── core/                   # Configuración Django (settings, URLs, ASGI)
│   │   ├── settings.py
│   │   ├── urls.py             # Router DRF + endpoints JWT
│   │   └── asgi.py             # Punto de entrada ASGI (HTTP + WebSocket)
│   ├── users/                  # App principal
│   │   ├── models.py           # User, Driver, Passenger, Route, Tracking, PickupStatus
│   │   ├── serializers.py      # 6 serializers (User, Driver, Passenger, Route, Tracking)
│   │   ├── views.py            # 5 ViewSets con permisos por rol
│   │   ├── permissions.py      # IsAdmin, IsDriver, IsPassenger
│   │   └── admin.py            # UserAdmin personalizado
│   ├── tracking/
│   │   ├── consumers.py        # WebSocket consumer (TrackingConsumer)
│   │   └── routing.py          # ProtocolTypeRouter (HTTP + WS)
│   ├── routes/                 # App de rutas (modelos auxiliares)
│   ├── manage.py
│   └── requirements.txt
│
├── frontend/
│   ├── public/
│   │   ├── index.html          # SEO, OG, Twitter Card, JSON-LD, lang=es
│   │   └── favicon.svg
│   └── src/
│       ├── App.js              # Router principal, auth state, navbar condicional
│       ├── pages/
│       │   ├── LoginPage.js    # Split-screen SaaS (branding + formulario)
│       │   ├── DashboardPage.js
│       │   ├── TrackingPage.js
│       │   ├── AdminUsersPage.js
│       │   ├── AdminDriversPage.js
│       │   └── AdminRoutesPage.js
│       ├── components/
│       │   ├── Modal.js
│       │   ├── Logo.js
│       │   ├── PrivateRoute.js
│       │   └── dashboard/
│       └── services/
│           ├── api.js          # Instancia Axios con interceptor JWT
│           ├── auth.js         # getCurrentUser()
│           ├── admin.js        # CRUD usuarios, conductores, rutas
│           ├── dashboard.js
│           └── ws.js           # connectTrackingWS()
│
├── estado_proyecto.txt
├── README.md
├── run_vialtros.bat
└── reiniciar_todo.bat
```

---

## Flujo de Autenticación

```text
1. Usuario envía credenciales → POST /api/token/
2. Backend valida y devuelve { access, refresh }
3. Frontend almacena tokens en localStorage (access, refresh, role, username)
4. Cada request REST incluye: Authorization: Bearer <access>
5. Al iniciar la app, se llama GET /api/users/me/ para validar el token
   → Si falla → logout forzado (limpieza de localStorage)
6. El rol (admin/driver/user) determina las rutas disponibles
```

---

## Flujo WebSocket (Tracking)

```text
1. Frontend abre: ws://localhost:8000/ws/tracking/<routeId>/
2. Django Channels enruta al TrackingConsumer
3. Consumer recibe mensajes JSON con { latitude, longitude, ... }
4. Frontend actualiza el mapa Leaflet en tiempo real
```

---

## Permisos por Rol

| Rol | Acceso |
| --- | --- |
| `admin` | CRUD total: usuarios, conductores, rutas, pasajeros |
| `driver` | Ver sus rutas asignadas, marcar estado de pasajeros |
| `user` | Ver su ruta en tiempo real + datos del conductor |

Los permisos se aplican en dos niveles:

1. **Backend:** Clases `IsAdmin`, `IsDriver`, `IsPassenger` en cada ViewSet
2. **Frontend:** `PrivateRoute` + comprobación de `role` en localStorage
