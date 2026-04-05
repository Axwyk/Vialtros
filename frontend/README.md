## Autenticación y rutas protegidas

- El login se realiza en `/login` y guarda los tokens JWT en localStorage.
- Las rutas protegidas usan el componente `PrivateRoute`.
- El botón "Salir" elimina los tokens y redirige al login.
- El token se envía automáticamente en cada request a la API.

**Ejemplo de uso:**
```js
import PrivateRoute from './components/PrivateRoute';
<Route path="/tracking/:routeId" element={
	<PrivateRoute>
		<TrackingPage routeId={1} />
	</PrivateRoute>
} />
```
# Frontend Vialtros

## Estructura
- `src/`: Código fuente React
- `src/components/`: Componentes reutilizables
- `src/pages/`: Vistas principales
- `src/store/`: Estado global (Redux)
- `src/services/`: Lógica de API y WebSocket

## Instalación
```bash
npm install
```

## Ejecución
```bash
npm start
```

-## Explicación y estructura
- **UI:** React + Tailwind CSS para diseño moderno, split-screen y responsive. Toda la iconografía es SVG inline outline profesional (sin emojis ni dependencias externas).
- **Landing:** Página principal split-screen, hero con SVG abstracto profesional, fondo suavizado (gradiente y SVG), sin emojis.
- **Estado:** Redux Toolkit para gestión de estado global (ver `src/store/`)
- **Servicios:**
	- `src/services/api.js`: Conexión a la API REST con JWT (usa axios)
	- `src/services/ws.js`: Conexión WebSocket para tracking en tiempo real
- **Mapa:**
	- `src/components/MapView.js`: Muestra ubicaciones y estados en un mapa (Leaflet)
- **Tracking en tiempo real:**
	- `src/pages/TrackingPage.js`: Página que consume WebSocket y actualiza el mapa
- **Autenticación:** JWT (tokens guardados en localStorage)

### Variables de entorno
Configura `.env` (o copia `.env.example`) para la URL del backend y WebSocket:
```
REACT_APP_API_URL=http://localhost:8000/api
REACT_APP_WS_URL=ws://localhost:8000/ws
```

### Ejemplo de uso de WebSocket
```js
import { connectTrackingWS } from './services/ws';
const socket = connectTrackingWS(1, (data) => console.log(data));
// Para enviar datos:
socket.send(JSON.stringify({ latitude: 10.5, longitude: -66.9, status: 'picked' }));
```
