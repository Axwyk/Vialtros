# Vialtros — Plataforma SaaS de Gestión de Rutas 🚗

**Versión:** 1.0-beta | **Última actualización:** 21 de mayo de 2026

> Plataforma moderna de gestión de rutas con seguimiento GPS en tiempo real, roles diferenciados y panel administrativo profesional.

## Enlaces útiles

- 📍 **Repositorio:** [github.com/Axwyk/Vialtros](https://github.com/Axwyk/Vialtros)
- 📋 **Trello:** [Vialtros board](https://trello.com/b/Uu3eBPav/vialtros)
- 🤝 **Reuniones:** Miércoles, Jueves y Domingo — 12:00 pm
- 📞 **Meet:** [meet.google.com/yfp-zmkq-buk](https://meet.google.com/yfp-zmkq-buk)

Plataforma SaaS de gestión de rutas con seguimiento GPS en tiempo real, roles diferenciados y panel administrativo profesional.

**Características principales:**

- ✓ Autenticación JWT con roles (Admin, Driver, User)
- ✓ Dashboard SaaS con estadísticas y gráficos
- ✓ WebSocket para tracking en tiempo real
- ✓ CRUD completo de usuarios, conductores y rutas
- ✓ Interfaz moderna con Tailwind CSS y diseño split-screen
- ✓ Iconografía SVG profesional (sin dependencias externas)

## 📊 Estado actual

**V1 con funcionalidades core completadas.** El proyecto incluye:
- ✅ Autenticación JWT con roles (Admin, Driver, User)
- ✅ Backend con API REST y WebSockets en tiempo real
- ✅ Frontend SaaS moderno con React 19 y Tailwind CSS
- ✅ Panel administrativo completo (CRUD de usuarios, conductores, rutas)
- ✅ CI/CD Pipeline (GitHub Actions + Deploy automático)
- 🔄 Sistema de notificaciones (en desarrollo)
- 🔄 Mejoras en mapas y tracking (en progreso)

Ver [**estado_proyecto.txt**](estado_proyecto.txt) para detalles completos de funcionalidades implementadas, pendientes y bugs resueltos.

## 🚀 Inicio rápido

### Windows (recomendado)

Desde la raíz del proyecto, ejecuta el script de arranque:

```powershell
.\run_vialtros.bat
```

Esto inicia automáticamente:
- **Backend:** http://localhost:8000
- **Frontend:** http://localhost:3000

### Credenciales de acceso

```
Usuario: admin
Contraseña: admin123
```

### Instalación manual (desarrollo)

Ver [**docs/despliegue.md**](docs/despliegue.md) para instalación paso a paso.




## 🛠️ Stack Tecnológico

| Capa | Tecnología |
| --- | --- |
| **Backend** | Django 4+ · Django REST Framework · Channels · daphne |
| **Frontend** | React 19 · Tailwind CSS · React Router v7 · Lucide Icons |
| **Base de Datos** | SQLite (desarrollo) / PostgreSQL (producción) |
| **Real-time** | Django Channels + Redis (opcional) |
| **Autenticación** | SimpleJWT · Permisos por rol |
| **DevOps** | GitHub Actions · SSH Deploy |

## 👥 Roles y Permisos

| Rol | Permisos | Acceso |
| --- | --- | --- |
| **Admin** | CRUD completo (usuarios/conductores/rutas) | `/admin/*` |
| **Driver** | Ver rutas asignadas, marcar pasajeros recogidos | `/driver/routes` |
| **User** (Pasajero) | Visualizar ubicación en tiempo real | `/user/route` |

## 📁 Estructura del Proyecto

```text
Vialtros/
├── backend/
│   ├── core/              # Configuración (settings, urls, asgi, cors)
│   ├── users/             # Modelos, serializers, viewsets (incluye rutas)
│   ├── tracking/          # Consumers WebSocket, modelo Tracking
│   ├── .venv/             # Entorno virtual Python
│   ├── db.sqlite3         # Base de datos (desarrollo)
│   ├── manage.py
│   ├── requirements.txt   # Dependencias Python
│   └── start_backend.bat  # Script arranque backend
│
├── frontend/ (Limpio de archivos de Django huérfanos)
│   ├── public/            # HTML estático, favicon
│   ├── build/             # Output compilado (React build)
│   ├── src/
│   │   ├── pages/         # LoginPage, DashboardPage, AdminPages
│   │   ├── components/    # Logo, Modal, Navbar, Sidebar, etc.
│   │   └── services/      # api.js, auth.js, admin.js, ws.js
│   ├── node_modules/      # Dependencias npm
│   ├── package.json       # Dependencias JavaScript
│   └── tailwind.config.js # Config Tailwind CSS
│
├── .github/
│   └── workflows/         # CI/CD (GitHub Actions)
│       └── backend.yml    # Deploy automático backend
│
├── docs/                  # 📖 Documentación técnica
│   ├── README.md          # Índice de documentación
│   ├── arquitectura.md    # Stack, diagrama, seguridad
│   ├── modelos.md         # BD, serializers, permisos
│   ├── api.md             # Referencia de endpoints
│   ├── frontend.md        # Páginas, componentes, env
│   └── despliegue.md      # Instalación, producción, CI/CD
│
├── estado_proyecto.txt    # ✅ Checklist de features
├── README.md              # Este archivo
├── package.json           # Dependencias proyecto (npm)
└── run_vialtros.bat       # 🚀 Script arranque rápido
```

## 📦 Requisitos

- **Python** 3.10+ (backend)
- **Node.js** 18+ (frontend)
- **PostgreSQL** (recomendado para producción)
- **Git** (para clonar repositorio)

## 📖 Documentación

Para guías detalladas, consulta la carpeta [**docs/**](docs/):

- [**arquitectura.md**](docs/arquitectura.md) — Stack, diagrama del sistema, flujo de autenticación
- [**modelos.md**](docs/modelos.md) — Modelos de BD, serializers, permisos
- [**api.md**](docs/api.md) — Referencia completa de endpoints (REST y WebSocket)
- [**frontend.md**](docs/frontend.md) — Páginas, componentes, variables de entorno
- [**despliegue.md**](docs/despliegue.md) — Instalación, configuración de desarrollo/producción, CI/CD

## 🔐 Seguridad

- ✅ Autenticación JWT con refresh token
- ✅ CORS configurado
- ✅ Validación de permisos por rol en backend
- ✅ Passwords hasheados (bcrypt via Django)
- ⚠️ **Producción:** Cambiar `SECRET_KEY`, activar HTTPS, usar PostgreSQL

## 🐛 Reportar Bugs

En [estado_proyecto.txt](estado_proyecto.txt) encontrarás el histórico de bugs resueltos.

Para reportar nuevos issues, crea un [issue en GitHub](https://github.com/Axwyk/Vialtros/issues).

## 📝 Licencia

Proyecto privado — contacta al equipo para más información.

## 👨‍💻 Equipo

Equipo de desarrollo de Vialtros. Reuniones: Miércoles, Jueves y Domingo a las 12:00 pm.

---

**¿Necesitas ayuda?** Ver [docs/despliegue.md](docs/despliegue.md) o contacta al equipo en Slack.

### Backend (desarrollo)

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate         # Windows
# source .venv/bin/activate      # Linux/Mac

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

El script `poblar_demo` ya no está incluido en el proyecto. Usa el panel de administración Django o API para crear datos de prueba manualmente.

## Documentación Completa

Consulta la carpeta [`docs/`](docs/) para:

- [Arquitectura del sistema](docs/arquitectura.md)
- [Modelos de datos](docs/modelos.md)
- [Referencia de API](docs/api.md)
- [Guía frontend](docs/frontend.md)
- [Despliegue en producción](docs/despliegue.md)
