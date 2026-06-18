# Vialtros - Guía de Despliegue

## Resumen Rápido

El proyecto ha sido preparado para desplegar en Apache con las siguientes características:

✅ **Usuario Admin de Prueba**: usuario `admin`, contraseña `admin123`
✅ **Base de Datos**: Neon PostgreSQL configurada
✅ **Backend**: Django + Gunicorn configurado para producción
✅ **Frontend**: React compilado para producción
✅ **Servidor Web**: Apache con reverse proxy
✅ **Automatización**: GitHub Actions workflow para despliegue automático
✅ **Documentación**: Guía completa paso a paso

---

## Archivos Importantes

| Archivo | Descripción |
|---------|-------------|

| **GUIA_DESPLIEGUE_APACHE.txt** | 📖 Guía completa (¡Lee esto!) |
| **deploy.sh** | 🚀 Script de despliegue local |
| **quick-setup.sh** | ⚡ Setup rápido en servidor |
| **.github/workflows/deploy-apache.yml** | 🤖 Workflow automático (GitHub Actions) |
| **backend/.env** | 🔐 Variables de entorno (Django) |
| **etc/apache2/vialtros.conf** | ⚙️ Configuración de Apache |
| **etc/systemd/vialtros-django.service** | 🔧 Service de Systemd para Django |
| **backend/users/management/commands/create_admin.py** | 👤 Script para crear admin |

---

## Inicio Rápido

### Opción 1: Despliegue Local (para pruebas)

```bash
# En tu máquina local
bash deploy.sh development
```

Esto ejecutará:
- Instalar dependencias backend
- Ejecutar migraciones
- Crear usuario admin
- Construir frontend

### Opción 2: Despliegue en Apache (recomendado)

**Ver la guía completa: `GUIA_DESPLIEGUE_APACHE.txt`**

En resumen:

```bash
# En el servidor Apache
ssh user@ds1.eleueleo.com
cd vialtros
bash quick-setup.sh  # Setup automático

# Luego (como sudo)
sudo cp etc/systemd/vialtros-django.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl start vialtros-django
sudo cp etc/apache2/vialtros.conf /etc/apache2/sites-available/
sudo a2ensite vialtros && sudo systemctl restart apache2
```

### Opción 3: Despliegue Automático (GitHub Actions)

1. Configura los GitHub Secrets en: https://github.com/Axwyk/Vialtros/settings/secrets/actions

2. Push a la rama `master`:
   ```bash
   git add .
   git commit -m "Prepare deployment"
   git push origin master
   ```

3. El workflow se ejecutará automáticamente

Ver sección 4-5 de `GUIA_DESPLIEGUE_APACHE.txt` para instrucciones detalladas.

---

## Usuario Administrador

**Para pruebas:**
- Usuario: `admin`
- Contraseña: `admin123`

**Acceso:**
- Panel de Admin: http://vialtros.ds1.eleueleo.com/admin
- API: http://vialtros.ds1.eleueleo.com/api

⚠️ **En Producción**: Cambia esta contraseña inmediatamente

### Variables de entorno del frontend (desarrollo)

Crear `frontend/.env`:

```env
REACT_APP_API_URL=http://localhost:8000/api
REACT_APP_WS_URL=ws://localhost:8000/ws
```

```bash
npm start
```

> Por defecto React escucha en `http://localhost:3000`.

---

## Configuración del Servidor

### Estructura de Directorios

```
/home/user/vialtros/
├── backend/
│   ├── venv/                      # Virtual environment
│   ├── .env                       # Variables de entorno
│   ├── core/                      # Django settings
│   ├── users/
│   ├── tracking/
│   └── manage.py
├── frontend/
│   ├── build/                     # React build (servido por Apache)
│   └── package.json
├── .github/
│   └── workflows/
│       └── deploy-apache.yml      # GitHub Actions
└── etc/
    ├── apache2/
    │   └── vialtros.conf          # Apache Virtual Host
    └── systemd/
        └── vialtros-django.service # Systemd service
```

### Servicios

| Servicio | Puerto | Descripción |
|----------|--------|------------|
| Apache | 80 | Servidor web (frontend + proxy) |
| Gunicorn | 8000 | Django WSGI server |
| Neon | Remoto | Base de datos PostgreSQL |

---

## Variables de Entorno

Ubicación: `backend/.env`

```
DJANGO_SECRET_KEY=...              # Clave secreta de Django
DJANGO_DEBUG=False                 # SIEMPRE False en producción
DJANGO_ALLOWED_HOSTS=...           # Dominios permitidos

DB_ENGINE=django.db.backends.postgresql
DB_NAME=neondb
DB_USER=neondb_owner
DB_PASSWORD=...                    # Tu contraseña de Neon
DB_HOST=...                        # Tu host de Neon
DB_PORT=5432

CORS_ALLOWED_ORIGINS=...           # Dominios CORS permitidos
```

---

## Dominio

Tu aplicación está configurada para funcionar en:

- **Frontend**: http://vialtros.ds1.eleueleo.com
- **Backend API**: http://vialtros.ds1.eleueleo.com/api
- **Admin Panel**: http://vialtros.ds1.eleueleo.com/admin

---

## Próximos Pasos

1. **Lee la guía completa**: `GUIA_DESPLIEGUE_APACHE.txt`
2. **Configura el servidor**: Sigue la sección 2 de la guía
3. **Configura GitHub Secrets**: Sección 4 de la guía
4. **Prueba el despliegue**: Sección 5 o 6 de la guía
5. **Accede a tu aplicación**: http://vialtros.ds1.eleueleo.com
6. **Inicia sesión**: admin / admin123
7. **Cambia la contraseña**: En producción

---

## Troubleshooting

Para problemas comunes, ver sección 9: **TROUBLESHOOTING** en `GUIA_DESPLIEGUE_APACHE.txt`

---

## Información Técnica

**Stack Tecnológico:**
- Backend: Django 6.0 + Django REST Framework + WebSockets (Channels)
- Frontend: React 18 + Axios
- Base de Datos: PostgreSQL 17 (Neon)
- Servidor Web: Apache 2.4 + Gunicorn
- Despliegue: GitHub Actions

**Monitoreo:**
- Logs de Django: `sudo journalctl -u vialtros-django -f`
- Logs de Apache: `sudo tail -f /var/log/apache2/vialtros-error.log`
- GitHub Actions: https://github.com/Axwyk/Vialtros/actions

**Funcionalidades del admin Django:**

- Gestión de todos los modelos (User, Driver, Passenger, Route, Tracking)
- Visualización y edición de registros directamente en la base de datos
- Solo accesible para usuarios con `is_staff=True`

---

## Contacto / Ayuda

Para más información, consulta:
- 📖 `GUIA_DESPLIEGUE_APACHE.txt` (Guía completa)
- 🔧 `etc/README.md` (Configuraciones de servidor)
- 🚀 `.github/workflows/deploy-apache.yml` (Workflow automático)

---

**Fecha de preparación:** 24 de mayo de 2026
**Proyecto:** Vialtros
**Dominio:** vialtros.ds1.eleueleo.com
**BD:** Neon (hidden-mud-15767585)

## Checklist antes de producción

- [ ] `DEBUG = False`
- [ ] `SECRET_KEY` no hardcodeada (variable de entorno)
- [ ] `ALLOWED_HOSTS` configurado
- [ ] Base de datos PostgreSQL configurada
- [ ] Redis activo para Django Channels
- [ ] CORS configurado solo con orígenes permitidos
- [ ] HTTPS habilitado (certificado SSL)
- [ ] Variables de entorno del frontend apuntan a URLs de producción (`https://` y `wss://`)
- [ ] `npm run build` ejecutado para generar los estáticos
- [ ] Archivos estáticos Django recolectados: `python manage.py collectstatic`
