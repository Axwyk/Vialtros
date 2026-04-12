# Documentación — Vialtros

Plataforma SaaS de gestión de rutas con seguimiento GPS en tiempo real.

## Índice

| Archivo | Contenido |
| --- | --- |
| [arquitectura.md](arquitectura.md) | Stack tecnológico, diagrama del sistema, flujo de auth, estructura de directorios |
| [modelos.md](modelos.md) | Modelos de base de datos, diagrama ER, serializers, permisos |
| [api.md](api.md) | Referencia completa de endpoints REST y WebSocket |
| [frontend.md](frontend.md) | Páginas, componentes, servicios y variables de entorno del frontend |
| [despliegue.md](despliegue.md) | Guía de instalación, configuración de desarrollo y producción |

## Inicio rápido

```bash
# Backend
cd backend && pip install -r requirements.txt
python manage.py migrate && python manage.py runserver

# Frontend (en otra terminal)
cd frontend && npm install && npm start
```

Ver [despliegue.md](despliegue.md) para la configuración completa.

## Estado del proyecto

Ver [`estado_proyecto.txt`](../estado_proyecto.txt) para el detalle de funcionalidades listas y pendientes.
