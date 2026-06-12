# Configuración de Google Routes API

## ¿Qué Cambió?

Se reemplazó el sistema de enrutamiento de **Valhalla + OSRM** por **Google Routes API** para obtener rutas más precisas en Buenaventura.

## Pasos de Configuración

### 1. **Obtener la API Key**

En Google Cloud Console:

```
1. Ve a: https://console.cloud.google.com/
2. Selecciona tu proyecto
3. Habilita estas APIs:
   - ✅ Routes API
   - ✅ Route Optimization API (opcional, para múltiples paradas)
   - ✅ Roads API (para Road Snapping - requiere habilitación especial)
   
4. Crea una API Key:
   - Ve a: Credenciales
   - Clic en "Crear credenciales" → "Clave de API"
   - Copia la clave
```

### 2. **Configurar Variables de Entorno**

**Frontend (.env o .env.local):**

```bash
REACT_APP_GOOGLE_ROUTES_API_KEY=tu_clave_api_aqui
```

**Verificar que funciona:**

```bash
npm start
```

Si la API key está correctamente configurada, deberías ver:
- ✅ Rutas calculadas correctamente
- ✅ Sin errores en la consola del navegador

## Archivos Modificados

### Nuevos Archivos
- `src/services/googleRoutesApi.js` - Funciones de Google Routes API

### Archivos Modificados  
- `src/services/routing.js`:
  - ✅ Importa funciones de Google Routes API
  - ✅ `getStreetRoute()` → usa Google Routes API
  - ✅ `getStreetRouteThroughPoints()` → usa Google Routes API con waypoints
  - ✅ `snapPointToRoad()` → intenta Google Roads API
  - ✅ `getTrackedStreetRoute()` → usa Google Routes API con múltiples puntos

## Diferencias vs Valhalla

| Aspecto | Valhalla | Google Routes API |
|---------|----------|------------------|
| **Precisión** | ⚠️ A veces rutas incorrectas | ✅ Más preciso en ciudades |
| **Tráfico Real** | ❌ No | ✅ Sí (TRAFFIC_AWARE_OPTIMAL) |
| **Costo** | ✅ Gratis | 💰 Pago por solicitud |
| **Velocidad** | ✅ Rápido | ✅ Rápido |
| **Waypoints** | ✅ Soporta | ✅ Soporta (hasta 25) |

## Costos Estimados

### Routes API
- **Rutas simples**: $0.005 - $0.01 USD por solicitud
- **Con tráfico**: ligeramente más caro
- **Límite gratuito**: $200 USD/mes

### Route Optimization API (si la usas)
- **Optimización**: $0.005 USD por solicitud
- **Diferente endpoint**: https://routeoptimization.googleapis.com/

## Pruebas Locales

```bash
# 1. Inicia el frontend
cd frontend
npm start

# 2. Abre el navegador y ve a:
http://localhost:3000

# 3. Crea una ruta de prueba en Admin
# Deberías ver rutas precisas de Buenaventura
```

## Limitaciones y Consideraciones

### ✅ Soportado
- Rutas entre dos puntos
- Rutas con waypoints (hasta 25)
- Tráfico en tiempo real
- Múltiples idiomas (español)

### ⚠️ No Completamente Implementado
- **Road Snapping** (`snapPointToRoad`): Requiere habilitación de Roads API adicional
  - Por ahora retorna las coordenadas sin modificar
  - Implementación pendiente

### ❌ No Soportado
- **Route Optimization** (TSP - Traveling Salesman): Requiere habilitación y endpoint diferente
  - Función stub en `googleRoutesApi.js`
  - Requiere cambios adicionales en la arquitectura

## Fallbacks

Si Google Routes API falla:
1. **getStreetRoute()** → usa línea recta
2. **getStreetRouteThroughPoints()** → calcula por segmentos
3. **getTrackedStreetRoute()** → usa línea recta como último recurso

## Troubleshooting

### Error: "Google Routes API key not configured"
**Solución**: Agrega `REACT_APP_GOOGLE_ROUTES_API_KEY` a `.env`

### Error: "API key is invalid"  
**Solución**: 
1. Verifica que la API key sea correcta
2. Habilita Routes API en Google Cloud
3. Espera 1-2 minutos para que los cambios se apliquen

### Error: "Access Denied - insufficient permissions"
**Solución**: 
1. Habilita Routes API: https://console.cloud.google.com/apis/library/routes.googleapis.com
2. Habilita Route Optimization API: https://console.cloud.google.com/apis/library/routeoptimization.googleapis.com

### Las rutas siguen siendo incorrectas
**Causa**: El área de Buenaventura puede tener datos OpenStreetMap desactualizados
**Solución**: 
1. Reporta a OpenStreetMap: https://www.openstreetmap.org
2. Contacta a Google Maps: feedback form
3. Para TSP avanzado, usa Route Optimization API

## Próximos Pasos (Opcionales)

### 1. Implementar Road Snapping Completo
```javascript
// En googleRoutesApi.js, expandir snapPointToRoad() para usar Google Roads API
// Requiere: Google Cloud - Roads API habilitada
```

### 2. Implementar Route Optimization API
```javascript
// Para resolver TSP (viajante) automáticamente
// Útil para optimizar orden de paradas
// Requiere: Endpoint diferente y estructura diferente
```

### 3. Caché Persistente en Backend
```javascript
// Guardar rutas frecuentes en base de datos
// Reducir costos de API
```

## Referencias

- [Google Routes API Docs](https://developers.google.com/maps/documentation/routes)
- [Route Optimization API](https://developers.google.com/optimization/routing/start/overview)
- [Roads API (Road Snapping)](https://developers.google.com/maps/documentation/roads/snap)
- [Google Cloud Pricing](https://cloud.google.com/maps-platform/pricing)
