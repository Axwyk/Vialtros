import React, { useEffect, useMemo, useState } from 'react';
import Map, { Layer, Marker, Source, NavigationControl, GeolocateControl } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import './tracking-map.css';
import MapViewLegacy from './MapView';

const DEFAULT_CENTER = {
  longitude: -77.02824,
  latitude: 3.89243,
  zoom: 13,
  pitch: 0,
};

// Capa de ruta con estilo Uber: azul marino oscuro con patrón de guiones
const routeLineLayer = {
  id: 'route-line',
  type: 'line',
  paint: {
    'line-color': '#2E63D8',
    'line-width': 6,
    'line-opacity': 0.98,
    'line-dasharray': [3, 3],
    'line-blur': 0.5,
  },
  layout: {
    'line-cap': 'round',
    'line-join': 'round',
  },
};

function normalizeRouteCoordinates(routeCoordinates = []) {
  return routeCoordinates
    .map((point) => {
      if (Array.isArray(point) && point.length === 2) {
        const first = Number(point[0]);
        const second = Number(point[1]);

        if (!Number.isFinite(first) || !Number.isFinite(second)) {
          return null;
        }

        // Soporta [lng, lat] (GeoJSON) y [lat, lng] desde APIs heredadas.
        return Math.abs(first) > 90 ? [first, second] : [second, first];
      }

      if (point && typeof point === 'object') {
        const lat = Number(point.lat ?? point.latitude);
        const lng = Number(point.lng ?? point.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          return [lng, lat];
        }
      }

      return null;
    })
    .filter(Boolean);
}

function resolveMapboxToken() {
  return process.env.REACT_APP_MAPBOX_TOKEN || process.env.VITE_MAPBOX_TOKEN || '';
}

export default function TrackingMap({
  vehiclePosition = null,
  routeCoordinates = [],
  mapStyle = null,
  height = '560px',
}) {
  const [viewState, setViewState] = useState(DEFAULT_CENTER);
  const mapboxToken = resolveMapboxToken();
  
  // Resuelve el estilo: Mapbox si hay token, sino usa OpenStreetMap gratuito
  const resolvedStyle = mapboxToken && mapStyle 
    ? mapStyle 
    : 'https://basemaps.cartocdn.com/gl/positron-nolabels/style.json';

  const normalizedRoute = useMemo(
    () => normalizeRouteCoordinates(routeCoordinates),
    [routeCoordinates],
  );

  const routeGeoJson = useMemo(
    () => ({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: normalizedRoute,
      },
    }),
    [normalizedRoute],
  );

  const vehicleLat = Number(vehiclePosition?.lat ?? vehiclePosition?.latitude);
  const vehicleLng = Number(vehiclePosition?.lng ?? vehiclePosition?.longitude);
  const hasVehicle = Number.isFinite(vehicleLat) && Number.isFinite(vehicleLng);

  useEffect(() => {
    if (!hasVehicle) return;

    setViewState((prev) => ({
      ...prev,
      latitude: vehicleLat,
      longitude: vehicleLng,
    }));
  }, [hasVehicle, vehicleLat, vehicleLng]);

  if (!mapboxToken) {
    // Fallback a Leaflet cuando no hay token Mapbox disponible
    const trackingsData = vehiclePosition 
      ? [{
          latitude: vehiclePosition.lat ?? vehiclePosition.latitude,
          longitude: vehiclePosition.lng ?? vehiclePosition.longitude,
        }]
      : [];

    return (
      <MapViewLegacy
        trackings={trackingsData}
        routePolyline={routeCoordinates}
        mapHeight={height}
      />
    );
  }

  return (
    <div style={{ height, width: '100%', borderRadius: 16, overflow: 'hidden', position: 'relative' }} className="tracking-map-container">
      <Map
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        mapStyle={resolvedStyle}
        mapboxAccessToken={mapboxToken}
        attributionControl={false}
      >
        {/* Controles de navegación */}
        <NavigationControl position="top-right" />
        <GeolocateControl position="top-right" />

        {normalizedRoute.length > 1 && (
          <Source id="tracking-route" type="geojson" data={routeGeoJson}>
            <Layer {...routeLineLayer} />
          </Source>
        )}

        {hasVehicle && (
          <Marker longitude={vehicleLng} latitude={vehicleLat} anchor="center">
            <div className="vehicle-marker" title="Vehículo en movimiento">
              <div className="vehicle-marker-inner">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="16" height="12" rx="2"/>
                  <path d="M17 8h3l3 4v4h-6V8z"/>
                  <circle cx="5.5" cy="18.5" r="2.5"/>
                  <circle cx="18.5" cy="18.5" r="2.5"/>
                </svg>(
          <Marker longitude={normalizedRoute[0][1]} latitude={normalizedRoute[0][0]} anchor="center">
            <div className="location-marker origin" title="Origen">
              <svg viewBox="0 0 24 24" fill="currentColor" stroke="white" strokeWidth="1">
                <circle cx="12" cy="12" r="8"/>
              </svg>
            </div>
          </Marker>
        )}

        {normalizedRoute.length > 0 && normalizedRoute[normalizedRoute.length - 1] && (
          <Marker longitude={normalizedRoute[normalizedRoute.length - 1][1]} latitude={normalizedRoute[normalizedRoute.length - 1][0]} anchor="center">
            <div className="location-marker destination" title="Destino">
              <svg viewBox="0 0 24 24" fill="currentColor" stroke="white" strokeWidth="1">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8m3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5z"/>
              </svg>
            </div
          </Marker>
        )}
Leyenda en esquina inferior izquierda */}
      <div className="map-legend">
        <div className="legend-title">Leyenda</div>
        <div className="legend-item">
          <div className="legend-marker vehicle-dot"></div>
          <span>Vehículo</span>
        </div>
        <div className="legend-item">
          <div className="legend-marker origin-dot"></div>
          <span>Origen</span>
        </div>
        <div className="legend-item">
          <div className="legend-marker destination-dot"></div>
          <span>Destino</span>
        </div>
        <div className="legend-item">
          <div className="legend-line"></div>
          <span>Ruta</span>
        </div>
      </div>  className="tracking-map-label destination"
          style={{
            left: `calc(50% + ${(normalizedRoute[normalizedRoute.length - 1][1] - viewState.longitude) * Math.pow(2, viewState.zoom) * 0.038}px)`,
            top: `calc(50% - ${(normalizedRoute[normalizedRoute.length - 1][0] - viewState.latitude) * Math.pow(2, viewState.zoom) * 0.038}px)`,
          }}
        >
          Destino
        </div>
      )}
    </div>
  );
}
