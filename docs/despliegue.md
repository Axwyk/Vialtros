# Guía de Despliegue — Vialtros

## Requisitos previos

| Herramienta | Versión mínima |
| --- | --- |
| Python | 3.10+ |
| Node.js | 18+ |
| npm | 9+ |
| Redis | 6+ (para Django Channels en producción) |
| PostgreSQL | 14+ (solo producción) |

---

## Configuración de Desarrollo

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/vialtros.git
cd Vialtros
```

---

### 2. Backend

#### Crear entorno virtual e instalar dependencias

```bash
cd backend
python -m venv venv

# Windows
.\venv\Scripts\activate

# Linux / macOS
source venv/bin/activate

pip install -r requirements.txt
```

#### Dependencias instaladas (`requirements.txt`)

```txt
django
djangorestframework
djangorestframework-simplejwt
channels
channels-redis
psycopg2-binary
```

#### Aplicar migraciones y crear superusuario

```bash
python manage.py migrate
python manage.py createsuperuser
```

#### Iniciar servidor de desarrollo

```bash
# Con Daphne (HTTP + WebSocket)
daphne core.asgi:application

# O con el servidor de desarrollo estándar (solo HTTP)
python manage.py runserver
```

> Por defecto el servidor escucha en `http://localhost:8000`.

---

### 3. Frontend

```bash
cd frontend
npm install
```

#### Variables de entorno

Crear `frontend/.env`:

```env
REACT_APP_API_URL=http://localhost:8000/api
REACT_APP_WS_URL=ws://localhost:8000/ws
```

#### Iniciar servidor de desarrollo

```bash
npm start
```

> Por defecto React escucha en `http://localhost:3000`.

---

### 4. Scripts de conveniencia

| Script | Descripción |
| --- | --- |
| `poblar_demo.bat` | Aplica migraciones y carga datos de prueba |
| `reiniciar_todo.bat` | Lanza backend (Daphne) y frontend (React) en terminales separadas |

---

## Configuración de Producción

### Backend — Variables de entorno

Usar variables de entorno en lugar de valores hardcoded en `settings.py`:

```env
SECRET_KEY=<clave-secreta-larga-y-aleatoria>
DEBUG=False
ALLOWED_HOSTS=api.vialtros.com,www.vialtros.com

# PostgreSQL
DB_NAME=vialtros_db
DB_USER=vialtros_user
DB_PASSWORD=<password>
DB_HOST=localhost
DB_PORT=5432

# Redis (para Django Channels)
REDIS_URL=redis://localhost:6379/0
```

### settings.py — Ajustes para producción

```python
# Deshabilitar DEBUG
DEBUG = False

# ALLOWED_HOSTS desde variable de entorno
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', '').split(',')

# Base de datos PostgreSQL
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME'),
        'USER': os.environ.get('DB_USER'),
        'PASSWORD': os.environ.get('DB_PASSWORD'),
        'HOST': os.environ.get('DB_HOST', 'localhost'),
        'PORT': os.environ.get('DB_PORT', '5432'),
    }
}

# CORS — solo orígenes de producción
CORS_ALLOWED_ORIGINS = [
    "https://www.vialtros.com",
]

# SECRET_KEY desde variable de entorno
SECRET_KEY = os.environ.get('SECRET_KEY')
```

---

### Frontend — Build de producción

```bash
cd frontend
npm run build
```

El directorio `frontend/build/` contiene los archivos estáticos para servir con Nginx o similar.

#### Variables de entorno para producción

Crear `frontend/.env.production`:

```env
REACT_APP_API_URL=https://api.vialtros.com/api
REACT_APP_WS_URL=wss://api.vialtros.com/ws
```

---

### Redis (Django Channels)

En desarrollo se puede usar Redis local:

```bash
# Instalar Redis (Windows con WSL o Docker)
docker run -d -p 6379:6379 redis:alpine
```

En producción configurar `CHANNEL_LAYERS` con la URL de Redis:

```python
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [os.environ.get('REDIS_URL', 'redis://127.0.0.1:6379')],
        },
    },
}
```

---

### Nginx (proxy inverso recomendado)

Configuración básica para servir frontend + backend:

```nginx
server {
    listen 80;
    server_name vialtros.com www.vialtros.com;

    # Frontend React
    location / {
        root /var/www/vialtros/build;
        try_files $uri /index.html;
    }

    # API REST
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket
    location /ws/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

---

## Panel de Administración Django

Accesible en `/admin/` con las credenciales del superusuario.

**Funcionalidades del admin Django:**
- Gestión de todos los modelos (User, Driver, Passenger, Route, Tracking)
- Visualización y edición de registros directamente en la base de datos
- Solo accesible para usuarios con `is_staff=True`

---

## Datos de Prueba

Ejecutar `poblar_demo.bat` (Windows) o el script equivalente para cargar:

- Usuarios de ejemplo con cada rol
- Conductores y pasajeros vinculados
- Rutas de prueba con conductor asignado

---

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

