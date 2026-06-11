# ✅ CHECKLIST: Implementar Google Routes API

## 📋 PASO 1: Configuración en Google Cloud

- [ ] Ir a: https://console.cloud.google.com/apis/dashboard
- [ ] Seleccionar tu Proyecto Vialtros
- [ ] Habilitar "Routes API"
  - [ ] Busca "Routes API" en la librería de APIs
  - [ ] Click en "HABILITAR"
- [ ] Habilitar "Route Optimization API" (opcional pero recomendado)
  - [ ] Busca "Route Optimization API"
  - [ ] Click en "HABILITAR"
- [ ] Ir a: Credenciales (en el menú lateral)
- [ ] Click en "Crear credenciales" → "Clave de API"
- [ ] Copiar la clave generada (ej: `AIzaSyD...abc123xyz`)

**Ejemplo de API Key:**
```
AIzaSyD1234567890_abc_def_ghi_jkl_mno_pqr
```

---

## 📝 PASO 2: Configurar Variables de Entorno

### Opción A: Crear archivo `.env.local` en `frontend/`

```bash
cd C:\Users\user\Desktop\Proyectos\Vialtros\frontend
```

Crear archivo `.env.local` con:

```
REACT_APP_GOOGLE_ROUTES_API_KEY=tu_clave_api_aqui
```

⚠️ **NO** commitear este archivo a Git (ya está en `.gitignore`)

### Opción B: Usar `.env` (si ya existe)

```
REACT_APP_GOOGLE_ROUTES_API_KEY=AIzaSy...
```

---

## 🚀 PASO 3: Probar Localmente

```bash
# 1. Asegúrate que el backend está corriendo (opcional)
cd backend
python manage.py runserver 0.0.0.0:8000

# 2. En otra terminal, inicia el frontend
cd frontend
npm start
```

El navegador abrirá: http://localhost:3000

---

## 🧪 PASO 4: Prueba de Rutas

### En Administrador:

1. Ir a Admin → Rutas
2. Crear nueva ruta:
   - **Origen**: "Centro, Buenaventura"
   - **Destino**: "Bellavista"
   - Click en "Guardar"

3. Revisar en el mapa:
   - ✅ La ruta debe ser correcta (por calles)
   - ✅ Mostrar distancia y tiempo
   - ✅ NO debe ser una línea recta

### Si la ruta es correcta ✅
- Google Routes API está funcionando
- Puedes continuar con desarrollo normal

### Si hay errores ⚠️
Ver sección: "TROUBLESHOOTING" abajo

---

## 🔍 VERIFICAR ERRORES (F12 - Consola)

Abre Developer Tools (F12) → Console

### Error: "Google Routes API key not configured"
```
❌ Significa: Falta REACT_APP_GOOGLE_ROUTES_API_KEY
✅ Solución: 
   1. Verifica .env.local
   2. Reinicia: npm start
```

### Error: "API key is invalid"
```
❌ Significa: La clave es incorrecta o inválida
✅ Solución:
   1. Copia nuevamente la clave de Google Cloud
   2. Verifica que NO tenga espacios
   3. Reinicia: npm start
```

### Error: "Access Denied"
```
❌ Significa: Routes API no habilitada
✅ Solución:
   1. Ir a: https://console.cloud.google.com/apis/library/routes.googleapis.com
   2. Click en "HABILITAR"
   3. Esperar 1-2 minutos
   4. Reinicia: npm start
```

### Sin errores pero ruta es línea recta
```
❌ Significa: Fallback a línea recta (Google Routes API falló)
✅ Solución:
   1. Revisar consola (F12) por más detalles
   2. Verificar API Key
   3. Verificar cuota mensual en Google Cloud
   4. Reportar en Issues del proyecto
```

---

## 📊 MONITOREAR COSTOS

**Ir a:**
https://console.cloud.google.com/billing/

- Routes API: ~$0.01 por solicitud
- Estimación: 100 rutas/día = ~$30 USD/mes

**Tip:** Usa caché para reducir costos (ya implementado)

---

## 🔄 REVERSIÓN (Si es necesario)

Si necesitas volver a Valhalla:

1. Comentar el import en `routing.js`:
```javascript
// import { getStreetRoute, ... } from "./googleRoutesApi";
```

2. Descomentar funciones antiguas de Valhalla (están en el repositorio git)

3. Ejecutar:
```bash
git checkout -- frontend/src/services/routing.js
npm start
```

---

## ✨ RESUMEN: Qué Cambió

| Antes (Valhalla) | Ahora (Google Routes) |
|---|---|
| Rutas a veces incorrectas ❌ | Rutas precisas ✅ |
| Sin datos de tráfico ❌ | Tráfico real ✅ |
| Gratis pero impreciso | Pagado pero correcto ✅ |

---

## 📞 SOPORTE

Si algo no funciona:

1. **Revisar logs**: F12 → Console
2. **Revisar archivo**: `frontend/GOOGLE_ROUTES_API_SETUP.md`
3. **Revisar Google Cloud**: Console de APIs
4. **Crear Issue**: Con el error específico

---

## ✅ Confirmación Final

Cuando todo esté funcionando correctamente:

- [ ] La API Key está configurada en .env.local
- [ ] No hay errores en consola (F12)
- [ ] Las rutas se muestran correctamente en el mapa
- [ ] Los tiempos y distancias son realistas
- [ ] Puedo crear y editar rutas sin problemas

Si todo ✅, **¡Listo! Google Routes API está implementada correctamente.**

