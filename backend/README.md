# Backend Vialtros

## Estructura
- `core/`: Configuración principal de Django
- `users/`: Gestión de usuarios, roles y autenticación
- `routes/`: Modelos y lógica de rutas
- `tracking/`: Tracking en tiempo real y WebSockets


## Instalación y despliegue

### 1. Instalar dependencias
```bash
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configurar base de datos
Asegúrate de tener PostgreSQL y Redis corriendo. Edita `core/settings.py` con tus credenciales.

### 3. Migraciones y superusuario
```bash
python manage.py migrate
python manage.py createsuperuser
```

### 4. Ejecutar en desarrollo
```bash
python manage.py runserver  # Solo API REST
# o para WebSockets:
daphne core.asgi:application  # Requiere instalar daphne
```

### 5. Recomendaciones producción
- Usa `daphne` o `uvicorn` para ASGI.
- Configura Redis en producción.
- Usa variables de entorno para claves y credenciales.
- Revisa el archivo `.env.example` para ejemplo de configuración.

---

## Explicación y ejemplos de uso

### Roles
- **Admin, Driver, User** definidos en el modelo User (`users/models.py`).

### Modelos principales
- **User:** Usuarios del sistema (con rol)
- **Driver:** Relación uno a uno con User, datos de conductor
- **Passenger:** Relación uno a uno con User, datos de pasajero
- **Route:** Rutas, origen, destino, conductor y pasajeros
- **Tracking:** Estado de recogida y ubicación en tiempo real
- **PickupStatus:** Estado recogido/no recogido

### API REST y JWT
- **Autenticación:**
	- POST `/api/token/` — Obtiene access/refresh token JWT
		- Body: `{ "username": "<usuario>", "password": "<contraseña>" }`
	- POST `/api/token/refresh/` — Refresca el access token
		- Body: `{ "refresh": "<refresh_token>" }`
- **Usuarios:**
	- GET `/api/users/` — Lista usuarios (requiere JWT)
	- GET `/api/users/me/` — Usuario autenticado
- **Drivers:**
	- CRUD `/api/drivers/`
- **Passengers:**
	- CRUD `/api/passengers/`
- **Routes:**
	- CRUD `/api/routes/`
- **Tracking:**
	- CRUD `/api/tracking/`

Todos los endpoints requieren autenticación JWT (excepto /api/token/).


### WebSockets (tracking en tiempo real)
- Implementados con Django Channels y Redis.
- URL de conexión: `ws://<host>/ws/tracking/<route_id>/`
- Cada cliente se suscribe a un grupo por ruta (`route_id`).
- Al enviar un mensaje, se retransmite a todos los clientes conectados a esa ruta.

**Ejemplo de conexión WebSocket:**
```js
const socket = new WebSocket('ws://localhost:8000/ws/tracking/1/');
socket.onmessage = (event) => {
	const data = JSON.parse(event.data);
	// Actualiza el mapa o UI con la nueva ubicación
};
// Para enviar actualización:
socket.send(JSON.stringify({ latitude: 10.5, longitude: -66.9, status: 'picked' }));
```

**Notas:**
- Es necesario tener Redis corriendo en `localhost:6379` para el canal de WebSockets.
- El backend debe iniciarse con `daphne` o `python -m channels` para soporte ASGI/WebSockets.

---

Configura la base de datos PostgreSQL en `core/settings.py` antes de ejecutar migraciones.
