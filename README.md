# Vialtros

Reunion: Vialtros
Jueves, 9 abril · 12:00 – 1:00pm
Zona horaria: America/Bogota
Información para unirse a la reunión de Google Meet
Vínculo a la videollamada: https://meet.google.com/zkp-gxgc-zga

Plataforma SaaS de gestión de rutas con seguimiento en tiempo real, roles diferenciados y panel de administración. Actualmente orientada a rutas escolares, con arquitectura preparada para expansión a otros ámbitos.

## Estado actual

Proyecto en desarrollo activo. Ver `estado_proyecto.txt` para el detalle de funcionalidades listas y pendientes.

## Tecnologías

- **Backend:** Django 4+ · Django REST Framework · Django Channels · JWT (SimpleJWT)
- **Frontend:** React 19 · Tailwind CSS · React Router v7 · Leaflet · Redux Toolkit
- **Base de datos:** SQLite (dev) / PostgreSQL (prod)
- **WebSockets:** Daphne + Django Channels
- **Iconografía:** Solo SVG inline outline profesional (estilo Lucide), sin dependencias externas ni emojis en todo el frontend
- **Logo:** Componente SVG propio — favicon + wordmark en navbar y sidebar

## Roles

| Rol | Permisos |
| --- | --- |
| **Admin** | CRUD de usuario+s, conductores y rutas |
| **Driver** | Ve sus rutas y marca estado de pasajeros |
| **User** | Visualiza la ubicación del vehículo en tiempo real |

## Estructura del proyecto

```
Vialtros/
├── backend/
│   ├── users/        # Modelos, auth, serializers, viewsets (User, Driver, Passenger)
│   ├── routes/       # Modelo Route
│   ├── tracking/     # WebSocket consumer + Tracking model
│   └── core/         # Settings, URLs, ASGI
├── frontend/
│   ├── public/       # index.html (SEO, OG, JSON-LD), favicon.svg
│   └── src/
│       ├── pages/    # LoginPage, DashboardPage, TrackingPage,
│       │             # AdminUsersPage, AdminDriversPage, AdminRoutesPage
│       ├── components/
│       │   ├── dashboard/  # Sidebar, StatCard, HeroCard, ActivityFeed, MiniChart, icons.js
│       │   ├── Logo.js     # Logo SVG reutilizable (variantes light/default)
│       │   └── Modal.js    # Modal reutilizable (cierre solo por botón)
│       └── services/       # auth.js, dashboard.js, admin.js, ws.js
└── venv/
```

## Instalación y despliegue

### Requisitos previos

- Python 3.10+
- Node.js 18+
- PostgreSQL (producción)

### Backend

```bash
cd backend
python -m venv venv
.\venv\Scripts\activate  # Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
npm start
```

- Sistema de roles: Admin, Driver, User
- API RESTful con JWT + permisos por rol en cada ViewSet
- CRUD completo de usuarios, conductores y rutas desde el panel admin
- WebSockets para tracking en tiempo real (Django Channels + Daphne)
- Dashboard SaaS: StatCards, MiniChart SVG, ActivityFeed, HeroCard animada
- Login split-screen: panel de branding + formulario con iconos SVG outline (sin emojis), show/hide password, spinner
- Landing page split-screen: hero con SVG abstracto profesional, fondo suavizado (gradiente y SVG), solo iconografía SVG inline outline
- Logo SVG propio (favicon, navbar, sidebar) con variantes light/default
- SEO completo en index.html: meta tags, Open Graph, Twitter Card, JSON-LD schema
- Título de pestaña genérico: "Vialtros — Gestión de rutas"

## Scripts de desarrollo

- `poblar_demo.bat` — Aplica migraciones y carga datos de prueba
- `reiniciar_todo.bat` — Lanza backend (Daphne) y frontend (React) en terminales separadas

1. Reinicia la terminal para que los cambios surtan efecto.
2. Crea la base de datos ejecutando:

   ```bash
   psql -U postgres -c "CREATE DATABASE vialtros_db;"
   ```

3. Si usas Amazon RDS, solo cambia los datos de conexión en el backend.
