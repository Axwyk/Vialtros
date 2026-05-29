# Documentación — Vialtros

> Plataforma SaaS de gestión de rutas con seguimiento GPS en tiempo real.  
> **Versión:** 1.0-beta | **Última actualización:** 21 de mayo de 2026

## 📑 Índice de Documentación

| Archivo | Contenido |
| --- | --- |
| [**arquitectura.md**](arquitectura.md) | Stack tecnológico, diagrama del sistema, flujo de autenticación, seguridad |
| [**modelos.md**](modelos.md) | Modelos de base de datos, diagrama ER, serializers, permisos por rol |
| [**api.md**](api.md) | Referencia completa de endpoints REST y WebSocket |
| [**frontend.md**](frontend.md) | Descripción de páginas, componentes reutilizables, servicios, variables de entorno |
| [**despliegue.md**](despliegue.md) | Guía de instalación, configuración de desarrollo/producción, CI/CD con GitHub Actions |

## 🚀 Inicio Rápido

Desde la raíz del proyecto en Windows:

```powershell
.\run_vialtros.bat
```

Esto inicia automáticamente:
- **Backend:** `http://localhost:8000`
- **Frontend:** `http://localhost:3000`

### Credenciales de prueba

```
Usuario: admin
Contraseña: admin123
```

## 📊 Estado del Proyecto

Para ver las funcionalidades implementadas, pendientes y bugs resueltos, consulta:

[**../estado_proyecto.txt**](../estado_proyecto.txt)

## 🏗️ Arquitectura de Alto Nivel

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (React)                     │
│  LoginPage → DashboardPage → AdminPages, DriverPages    │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP / WebSocket
                       ↓
┌─────────────────────────────────────────────────────────┐
│              Backend (Django REST + Channels)            │
│  API REST + WebSocket Consumer para tracking en vivo    │
│  Autenticación JWT | Permisos por rol                   │
└──────────────────────┬──────────────────────────────────┘
                       │ SQL
                       ↓
┌─────────────────────────────────────────────────────────┐
│              Base de Datos (SQLite/PostgreSQL)           │
│  Users, Drivers, Routes, Tracking, PickupStatus         │
└─────────────────────────────────────────────────────────┘
```

## 🔐 Seguridad

- ✅ Autenticación JWT con refresh token
- ✅ CORS configurado
- ✅ Validación de permisos en cada endpoint
- ✅ Passwords hasheados (bcrypt)
- ⚠️ **Producción:** Ver checklist en [despliegue.md](despliegue.md)

## 🛠️ Stack Tecnológico

| Capa | Herramientas |
| --- | --- |
| **Backend** | Django 4 · DRF · Channels · daphne · PostgreSQL |
| **Frontend** | React 19 · Tailwind CSS · React Router v7 · Lucide Icons |
| **Real-time** | Django Channels + Redis |
| **Autenticación** | SimpleJWT |
| **DevOps** | GitHub Actions · SSH Deploy |

## 🤝 Contribution

Para contribuir al proyecto:

1. Crea una rama: `git checkout -b feature/mi-feature`
2. Haz commits claros: `git commit -m "Agrega mi-feature"`
3. Sube la rama: `git push origin feature/mi-feature`
4. Abre un Pull Request en GitHub

## 📞 Soporte

- **Repositorio:** [github.com/Axwyk/Vialtros](https://github.com/Axwyk/Vialtros)
- **Reuniones:** Miércoles, Jueves y Domingo a las 12:00 pm
- **Meet:** [meet.google.com/yfp-zmkq-buk](https://meet.google.com/yfp-zmkq-buk)

---

*Documentación última actualización: 21 de mayo de 2026*
