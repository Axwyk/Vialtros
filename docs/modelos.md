# Modelos de Datos — Vialtros

Todos los modelos se encuentran en `backend/users/models.py`.

---

## Diagrama de relaciones

```txt
┌──────────────────────────┐
│          User            │
│──────────────────────────│
│ id (PK)                  │
│ username (unique)        │
│ email                    │
│ password (hashed)        │
│ role: admin|driver|user  │
│ is_active                │
│ is_staff                 │
│ (hereda AbstractUser)    │
└────────────┬─────────────┘
             │ OneToOne
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
┌───────────┐   ┌────────────┐
│  Driver   │   │ Passenger  │
│───────────│   │────────────│
│ id (PK)   │   │ id (PK)    │
│ user (FK) │   │ user (FK)  │
│ license_  │   │ phone      │
│  number   │   └────────────┘
└─────┬─────┘         │ ManyToMany
      │ FK            │
      ▼               ▼
┌─────────────────────────────┐
│           Route             │
│─────────────────────────────│
│ id (PK)                     │
│ name                        │
│ origin                      │
│ destination                 │
│ driver (FK, nullable)       │
│ passengers (M2M Passenger)  │
└──────────────┬──────────────┘
               │ FK
               ▼
┌─────────────────────────────┐
│          Tracking           │
│─────────────────────────────│
│ id (PK)                     │
│ route (FK)                  │
│ passenger (FK)              │
│ status: picked|not_picked   │
│ latitude (float)            │
│ longitude (float)           │
│ timestamp (auto_now)        │
└─────────────────────────────┘
```

---

## Modelos

### `User`

Extiende `AbstractUser` de Django.

| Campo | Tipo | Descripción |
| --- | --- | --- |
| `id` | AutoField (PK) | Identificador único |
| `username` | CharField (unique) | Nombre de usuario |
| `email` | EmailField | Correo electrónico |
| `password` | CharField | Contraseña hasheada por Django |
| `role` | CharField | `admin`, `driver` o `user` |
| `is_active` | BooleanField | Cuenta activa/inactiva |
| `is_staff` | BooleanField | Acceso al panel de administración de Django |

> `AUTH_USER_MODEL = 'users.User'` configurado en `settings.py`.

---

### `Driver`

Perfil de conductor, vinculado 1:1 a un `User` con `role=driver`.

| Campo | Tipo | Descripción |
| --- | --- | --- |
| `id` | AutoField (PK) | Identificador único |
| `user` | OneToOneField → User | Usuario del sistema |
| `license_number` | CharField(50) | Número de licencia de conducir |

---

### `Passenger`

Perfil de pasajero, vinculado 1:1 a un `User` con `role=user`.

| Campo | Tipo | Descripción |
| --- | --- | --- |
| `id` | AutoField (PK) | Identificador único |
| `user` | OneToOneField → User | Usuario del sistema |
| `phone` | CharField(20) | Número de teléfono |

---

### `Route`

Ruta de transporte con conductor y pasajeros asignados.

| Campo | Tipo | Descripción |
| --- | --- | --- |
| `id` | AutoField (PK) | Identificador único |
| `name` | CharField(100) | Nombre de la ruta |
| `origin` | CharField(255) | Punto de origen |
| `destination` | CharField(255) | Punto de destino |
| `driver` | ForeignKey → Driver (nullable) | Conductor asignado. `SET_NULL` al eliminar. |
| `passengers` | ManyToManyField → Passenger | Pasajeros asignados |

---

### `PickupStatus`

`TextChoices` para el estado de recogida de un pasajero.

| Valor | Etiqueta |
| --- | --- |
| `picked` | Recogido |
| `not_picked` | No recogido |

---

### `Tracking`

Registro de posición GPS y estado de recogida para un pasajero en una ruta.

| Campo | Tipo | Descripción |
| --- | --- | --- |
| `id` | AutoField (PK) | Identificador único |
| `route` | ForeignKey → Route | Ruta a la que pertenece |
| `passenger` | ForeignKey → Passenger | Pasajero rastreado |
| `status` | CharField | `picked` o `not_picked` |
| `latitude` | FloatField | Latitud GPS |
| `longitude` | FloatField | Longitud GPS |
| `timestamp` | DateTimeField | Fecha/hora (auto_now, se actualiza en cada save) |

---

## Serializers

Ubicación: `backend/users/serializers.py`

| Serializer | Modelo | Uso |
| --- | --- | --- |
| `UserSerializer` | User | Lectura: `id, username, email, role, is_active, is_staff` |
| `UserBasicSerializer` | User | Lectura anidada: `id, username, email, role` |
| `UserCreateSerializer` | User | Creación/edición: incluye campo `password` write-only, llama a `set_password()` |
| `DriverSerializer` | Driver | Incluye `user_detail` (UserBasicSerializer anidado, read-only) |
| `PassengerSerializer` | Passenger | Incluye `user_detail` (UserBasicSerializer anidado, read-only) |
| `RouteSerializer` | Route | Incluye `driver_detail` (anidado) y `passenger_count` (SerializerMethodField) |
| `TrackingSerializer` | Tracking | Todos los campos (`fields = '__all__'`) |

---

## Permisos

Ubicación: `backend/users/permissions.py`

| Clase | Condición |
|---|---|
| `IsAdmin` | `request.user.is_authenticated and request.user.role == 'admin'` |
| `IsDriver` | `request.user.is_authenticated and request.user.role == 'driver'` |
| `IsPassenger` | `request.user.is_authenticated and request.user.role == 'user'` |
