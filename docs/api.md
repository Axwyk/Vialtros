# Referencia de API — Vialtros

> **Última actualización:** 21 de mayo de 2026

Base URL: `http://localhost:8000/api/`

Todos los endpoints (salvo `/token/`) requieren JWT en la cabecera:
```
Authorization: Bearer <access_token>
```

---

## Autenticación

### Obtener tokens
```
POST /api/token/
```
**Body:**
```json
{
  "username": "string",
  "password": "string"
}
```
**Respuesta 200:**
```json
{
  "access": "<jwt_access_token>",
  "refresh": "<jwt_refresh_token>"
}
```

### Refrescar token
```
POST /api/token/refresh/
```
**Body:**
```json
{
  "refresh": "<jwt_refresh_token>"
}
```
**Respuesta 200:**
```json
{
  "access": "<nuevo_access_token>"
}
```

---

## Usuarios

> Permiso requerido: **Admin** (salvo `/me/`)

### Listar usuarios
```
GET /api/users/
```
**Respuesta 200:**
```json
[
  {
    "id": 1,
    "username": "jdoe",
    "email": "jdoe@example.com",
    "role": "admin",
    "is_active": true,
    "is_staff": false
  }
]
```

### Crear usuario
```
POST /api/users/
```
**Body:**
```json
{
  "username": "string",
  "email": "string",
  "role": "admin | driver | user",
  "is_active": true,
  "password": "string (min 6 chars)"
}
```

### Obtener usuario
```
GET /api/users/{id}/
```

### Actualizar usuario (parcial)
```
PATCH /api/users/{id}/
```
La contraseña solo se actualiza si se incluye en el body.

### Eliminar usuario
```
DELETE /api/users/{id}/
```

### Usuario autenticado actual
```
GET /api/users/me/
```
> Permiso: cualquier usuario autenticado
```json
{
  "id": 1,
  "username": "jdoe",
  "email": "jdoe@example.com",
  "role": "admin",
  "is_active": true,
  "is_staff": false
}
```

### Usuarios asignados al conductor (acción extra)
```
GET /api/users/assigned_users/
```
> Permiso: **Driver**. Devuelve los pasajeros de las rutas asignadas al conductor autenticado.

### Conductor de mi ruta
```
GET /api/users/my_conductor/
```
> Permiso: **User (pasajero)**. Devuelve la ruta y datos del conductor asignado.
```json
{
  "route": { ... },
  "driver": { ... }
}
```

---

## Conductores

> Permiso requerido: **Admin**

### Listar conductores
```
GET /api/drivers/
```
```json
[
  {
    "id": 1,
    "user": 2,
    "user_detail": { "id": 2, "username": "carlos", "email": "...", "role": "driver" },
    "license_number": "B-1234"
  }
]
```

### Crear conductor
```
POST /api/drivers/
```
```json
{
  "user": 2,
  "license_number": "string"
}
```
> El `user` debe existir y tener `role=driver`.

### Obtener conductor
```
GET /api/drivers/{id}/
```

### Actualizar conductor (parcial)
```
PATCH /api/drivers/{id}/
```

### Eliminar conductor
```
DELETE /api/drivers/{id}/
```

---

## Pasajeros

> Permiso requerido: **Admin**

### Listar pasajeros
```
GET /api/passengers/
```
```json
[
  {
    "id": 1,
    "user": 3,
    "user_detail": { "id": 3, "username": "maria", "email": "...", "role": "user" },
    "phone": "+34 600 000 000"
  }
]
```

### CRUD
```
POST   /api/passengers/           → Crear
GET    /api/passengers/{id}/      → Detalle
PATCH  /api/passengers/{id}/      → Actualizar parcial
DELETE /api/passengers/{id}/      → Eliminar
```

---

## Rutas

> Permiso requerido: **Admin**

### Listar rutas
```
GET /api/routes/
```
```json
[
  {
    "id": 1,
    "name": "Ruta Norte",
    "origin": "Calle Mayor 1",
    "destination": "Polígono Industrial A",
    "driver": 1,
    "driver_detail": {
      "id": 1,
      "user": 2,
      "user_detail": { "id": 2, "username": "carlos", ... },
      "license_number": "B-1234"
    },
    "passengers": [1, 2, 3],
    "passenger_count": 3
  }
]
```

### Crear ruta
```
POST /api/routes/
```
```json
{
  "name": "string",
  "origin": "string",
  "destination": "string",
  "driver": 1
}
```

### CRUD
```
GET    /api/routes/{id}/          → Detalle
PATCH  /api/routes/{id}/          → Actualizar parcial
DELETE /api/routes/{id}/          → Eliminar
```

### Acciones extra sobre rutas

#### Asignar conductor
```
POST /api/routes/{id}/assign_driver/
```
```json
{ "driver_id": 1 }
```

#### Asignar pasajero
```
POST /api/routes/{id}/assign_passenger/
```
```json
{ "passenger_id": 1 }
```

#### Quitar pasajero
```
POST /api/routes/{id}/remove_passenger/
```
```json
{ "passenger_id": 1 }
```

---

## Tracking (posiciones GPS)

> Permiso requerido: **Admin**

### CRUD estándar
```
GET    /api/tracking/           → Listar registros
POST   /api/tracking/           → Crear registro
GET    /api/tracking/{id}/      → Detalle
PATCH  /api/tracking/{id}/      → Actualizar
DELETE /api/tracking/{id}/      → Eliminar
```

**Modelo de un registro de tracking:**
```json
{
  "id": 1,
  "route": 1,
  "passenger": 2,
  "status": "not_picked | picked",
  "latitude": 40.4168,
  "longitude": -3.7038,
  "timestamp": "2026-04-05T10:30:00Z"
}
```

---

## WebSocket — Tracking en Tiempo Real

```
ws://localhost:8000/ws/tracking/<route_id>/
```

### Conexión (ejemplo frontend)
```js
const socket = new WebSocket(`ws://localhost:8000/ws/tracking/1/`);
socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // { latitude, longitude, ... }
};
```

### Formato de mensaje entrante
```json
{
  "latitude": 40.4168,
  "longitude": -3.7038,
  "timestamp": "2026-04-05T10:30:00Z"
}
```

> El canal WebSocket usa el `TrackingConsumer` de Django Channels con `AuthMiddlewareStack`.
> Ruta registrada: `^ws/tracking/(?P<route_id>\d+)/$`

---

## Códigos de estado comunes

| Código | Significado |
|---|---|
| 200 | OK |
| 201 | Creado |
| 204 | Sin contenido (DELETE exitoso) |
| 400 | Bad Request (validación fallida) |
| 401 | No autenticado (token ausente o inválido) |
| 403 | Prohibido (rol insuficiente) |
| 404 | No encontrado |
