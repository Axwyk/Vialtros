# Vialtros

Reuniones: Miercoles, Jueves y Domingo - 12:00 pm 
link: https://meet.google.com/yfp-zmkq-buk

Plataforma SaaS de gestión de rutas con seguimiento GPS en tiempo real, roles diferenciados y panel administrativo profesional.

**Características principales:**

- ✓ Autenticación JWT con roles (Admin, Driver, User)
- ✓ Dashboard SaaS con estadísticas y gráficos
- ✓ WebSocket para tracking en tiempo real
- ✓ CRUD completo de usuarios, conductores y rutas
- ✓ Interfaz moderna con Tailwind CSS y diseño split-screen
- ✓ Iconografía SVG profesional (sin dependencias externas)

## Estado actual

Proyecto en desarrollo activo — **V1 con funcionalidades core completadas**. Ver [`estado_proyecto.txt`](estado_proyecto.txt) para detalles de implementado vs pendiente.

## Stack Tecnológico

| Componente | Tecnología |
| --- | --- |
| **Backend** | Django 4+ · Django REST Framework · Channels · SimpleJWT |
| **Frontend** | React 19 · Tailwind CSS · React Router v7 · Leaflet |
| **BD** | SQLite (dev) / PostgreSQL (producción) |
| **WebSockets** | Daphne + Django Channels |
| **Autenticación** | JWT con refresh token · Permisos por rol |

## Roles y Permisos

| Rol | Permisos |
| --- | --- |
| **Admin** | CRUD usuarios/conductores/rutas, acceso panel administrativo |
| **Driver** | Ve sus rutas asignadas, marca estado de pasajeros |
| **User** | Visualiza ubicación en tiempo real del vehículo |

## Estructura del Proyecto

```text
Vialtros/
├── backend/
│   ├── core/              # Configuración Django (settings, urls, asgi)
│   ├── users/             # Modelos User/Driver/Passenger, serializers, viewsets
│   ├── routes/            # Modelo Route y endpoints
│   ├── tracking/          # WebSocket consumer, Tracking model
│   ├── manage.py
│   └── requirements.txt
├── frontend/
│   ├── public/            # index.html + favicon.svg
│   ├── src/
│   │   ├── pages/         # LoginPage, DashboardPage, AdminPages
│   │   ├── components/    # Logo, Modal, MapView, Sidebar, etc.
│   │   └── services/      # api.js, auth.js, admin.js, ws.js
│   ├── package.json
│   └── tailwind.config.js
├── docs/                  # Documentación técnica
├── estado_proyecto.txt    # Funcionalidades listas y pendientes
└── README.md
```

## Instalación y Despliegue

### Requisitos

- Python 3.10+
- Node.js 18+
- PostgreSQL (recomendado para producción)

### Backend (desarrollo)

```bash
cd backend
python -m venv venv
.\venv\Scripts\activate         # Windows
# source venv/bin/activate      # Linux/Mac

pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

### Frontend (desarrollo)

```bash
cd frontend
npm install
npm start                       # http://localhost:3000
```

### Datos de prueba

```bash
cd backend
python manage.py poblar_demo   # Carga usuarios, conductores y rutas de demo
```

## Documentación Completa

Consulta la carpeta [`docs/`](docs/) para:

- [Arquitectura del sistema](docs/arquitectura.md)
- [Modelos de datos](docs/modelos.md)
- [Referencia de API](docs/api.md)
- [Guía frontend](docs/frontend.md)
- [Despliegue en producción](docs/despliegue.md)
