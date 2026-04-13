// Mapa en tiempo real con estilo limpio tipo navegacion
import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import './leaflet-fixes.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const originIcon = L.divIcon({
  className: '',
  html: `
    <div class="vt-route-point vt-route-point-start"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const destinationIcon = L.divIcon({
  className: '',
  html: `
    <div class="vt-route-point vt-route-point-end"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const BUENAVENTURA_CENTER = [3.89243, -77.02824];

function createVehicleIcon(label, status = 'Detenido') {
  const safeLabel = safeText(label || 'Vehiculo');
  const normalizedStatus = status === 'En ruta' ? 'moving' : 'idle';
  return L.divIcon({
    className: '',
    html: `
      <div class="vt-vehicle-chip vt-vehicle-chip-${normalizedStatus}">
        <span class="vt-vehicle-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <rect x="1" y="4" width="16" height="12" rx="2"></rect>
            <path d="M17 8h3l3 4v4h-6V8z"></path>
            <circle cx="5.5" cy="18.5" r="2.2"></circle>
            <circle cx="18.5" cy="18.5" r="2.2"></circle>
          </svg>
        </span>
        <span class="vt-vehicle-text">${safeLabel}</span>
      </div>`,
    iconSize: [132, 36],
    iconAnchor: [66, 18],
  });
}

function safeText(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createRouteLabelIcon(label, variant) {
  const safeLabel = safeText(label || (variant === 'start' ? 'Origen' : 'Destino'));
  return L.divIcon({
    className: '',
    html: `
      <div class="vt-route-chip vt-route-chip-${variant}">
        <span class="vt-route-chip-text">${safeLabel}</span>
        <span class="vt-route-chip-arrow">›</span>
      </div>`,
    iconSize: [220, 52],
    iconAnchor: variant === 'start' ? [10, 46] : [210, 46],
  });
}

function FitBounds({ coordinates, freezeAfterFirstFit = false }) {
  const map = useMap();
  const lastLengthRef = useRef(-1);
  const fittedOnceRef = useRef(false);

  useEffect(() => {
    if (!coordinates?.length) return;
    if (freezeAfterFirstFit && fittedOnceRef.current) return;
    if (coordinates.length === lastLengthRef.current) return;
    lastLengthRef.current = coordinates.length;

    const valid = coordinates.filter(
      (c) => c && Number.isFinite(c[0]) && Number.isFinite(c[1]),
    );
    if (!valid.length) return;

    if (valid.length === 1) {
      map.setView(valid[0], 15, { animate: false });
      fittedOnceRef.current = true;
      return;
    }

    const bounds = L.latLngBounds(valid);
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [80, 80], animate: false, maxZoom: 16 });
      fittedOnceRef.current = true;
    }
  }, [map, coordinates, freezeAfterFirstFit]);

  return null;
}

function AutoFollowVehicle({ vehiclePoint, enabled = true }) {
  const map = useMap();
  const firstFollowRef = useRef(true);

  useEffect(() => {
    if (!enabled || !vehiclePoint) return;

    const [lat, lng] = vehiclePoint;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    if (firstFollowRef.current) {
      firstFollowRef.current = false;
      map.setView([lat, lng], Math.max(map.getZoom(), 15), { animate: false });
      return;
    }

    map.flyTo([lat, lng], Math.max(map.getZoom(), 15), {
      animate: true,
      duration: 1.2,
      easeLinearity: 0.25,
    });
  }, [map, vehiclePoint, enabled]);

  return null;
}

/**
 * @param {Object[]}          trackings         Puntos de tracking del bus.
 * @param {[number,number][]} routePolyline     Coordenadas de la ruta por calles.
 * @param {[number,number]}   originCoords      [lat,lng] del origen.
 * @param {[number,number]}   destinationCoords [lat,lng] del destino.
 * @param {string}            originName        Nombre legible del origen.
 * @param {string}            destinationName   Nombre legible del destino.
 * @param {string}            mapHeight         Altura CSS del mapa (default "560px").
 */
export default function MapView({
  trackings = [],
  routePolyline = null,
  plannedRoutePolyline = null,
  traveledRoutePolyline = null,
  originCoords = null,
  destinationCoords = null,
  originName = null,
  destinationName = null,
  activeVehicles = [],
  vehiclePosition = null,
  mapHeight = '560px',
}) {
  const validPoints = trackings
    .map((t) => [Number(t.latitude), Number(t.longitude)])
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));

  const latestPoint = validPoints.length > 0 ? validPoints[validPoints.length - 1] : null;
  const center = latestPoint || originCoords || destinationCoords || BUENAVENTURA_CENTER;
  const startLabelIcon = useMemo(
    () => createRouteLabelIcon(originName || 'Origen', 'start'),
    [originName],
  );
  const endLabelIcon = useMemo(
    () => createRouteLabelIcon(destinationName || 'Destino', 'end'),
    [destinationName],
  );

  const plannedLine = plannedRoutePolyline?.length > 1
    ? plannedRoutePolyline
    : (routePolyline?.length > 1 ? routePolyline : null);
  const traveledLine = traveledRoutePolyline?.length > 1 ? traveledRoutePolyline : null;

  const fitCoords = plannedLine?.length > 1
    ? plannedLine
    : (traveledLine?.length > 1
      ? traveledLine
    : [
      ...[originCoords, destinationCoords].filter(Boolean),
      ...activeVehicles
        .filter((v) => Number.isFinite(v.latitude) && Number.isFinite(v.longitude))
        .map((v) => [v.latitude, v.longitude]),
    ]);

  const vehiclePoint = Number.isFinite(vehiclePosition?.latitude) && Number.isFinite(vehiclePosition?.longitude)
    ? [Number(vehiclePosition.latitude), Number(vehiclePosition.longitude)]
    : latestPoint;

  const hasLiveTrackings = validPoints.length > 0;

  return (
    <div style={{ position: 'relative', height: mapHeight }} className="tracking-map-container">
      {/* Filtro SVG — coloriza tiles: agua=azul, calles=blanco, bloques=teal */}
      <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} aria-hidden="true">
        <defs>
          <filter id="vt-map-colorize" colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values="0.95 0 -0.20 0 0.12  0.70 0.35 0.00 0 0.06  0.00 0.00 1.00 0 0.03  0 0 0 1 0"
            />
          </filter>
        </defs>
      </svg>
      <MapContainer
        center={center}
        zoom={14}
        style={{ height: '100%', width: '100%' }}
        className="vt-map-base"
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains="abcd"
          maxZoom={20}
        />

        {plannedLine?.length > 1 && (
          <>
            <Polyline
              positions={plannedLine}
              color="#64748b"
              weight={9}
              opacity={0.2}
              className="vt-planned-route-line-shadow"
            />
            <Polyline
              positions={plannedLine}
              color="#334155"
              weight={4}
              opacity={0.72}
              dashArray="10 10"
              lineCap="round"
              lineJoin="round"
              smoothFactor={1.2}
              className="vt-planned-route-line-main"
            />
          </>
        )}

        {traveledLine?.length > 1 && (
          <>
            <Polyline
              positions={traveledLine}
              color="#2E63D8"
              weight={8}
              opacity={0.2}
              className="vt-traveled-route-line-shadow"
            />
            <Polyline
              positions={traveledLine}
              color="#1d4ed8"
              weight={5}
              opacity={0.96}
              lineCap="round"
              lineJoin="round"
              smoothFactor={1.2}
              className="vt-traveled-route-line-main"
            />
          </>
        )}

        {originCoords && <Marker position={originCoords} icon={originIcon} interactive={false} />}
        {destinationCoords && <Marker position={destinationCoords} icon={destinationIcon} interactive={false} />}

        {activeVehicles.map((vehicle) => {
          if (!Number.isFinite(vehicle.latitude) || !Number.isFinite(vehicle.longitude)) {
            return null;
          }
          return (
            <Marker
              key={`${vehicle.label}-${vehicle.latitude}-${vehicle.longitude}`}
              position={[vehicle.latitude, vehicle.longitude]}
              icon={createVehicleIcon(vehicle.label, vehicle.status)}
              interactive={false}
            />
          );
        })}

        {originCoords && <Marker position={originCoords} icon={startLabelIcon} interactive={false} />}
        {destinationCoords && <Marker position={destinationCoords} icon={endLabelIcon} interactive={false} />}

        <FitBounds coordinates={fitCoords} freezeAfterFirstFit={hasLiveTrackings} />
        <AutoFollowVehicle vehiclePoint={vehiclePoint} enabled={hasLiveTrackings} />
      </MapContainer>

      {/* Leyenda del mapa */}
      <div className="map-legend">
        <div className="legend-title">Leyenda</div>
        {activeVehicles.length > 0 && (
          <div className="legend-item">
            <div className="legend-marker vehicle-dot"></div>
            <span>Vehiculo</span>
          </div>
        )}
        {originCoords && (
          <div className="legend-item">
            <div className="legend-marker origin-dot"></div>
            <span>Origen</span>
          </div>
        )}
        {destinationCoords && (
          <div className="legend-item">
            <div className="legend-marker destination-dot"></div>
            <span>Destino</span>
          </div>
        )}
        {plannedLine?.length > 1 && (
          <div className="legend-item">
            <div className="legend-line planned"></div>
            <span>Ruta planificada</span>
          </div>
        )}
        {traveledLine?.length > 1 && (
          <div className="legend-item">
            <div className="legend-line traveled"></div>
            <span>Ruta recorrida</span>
          </div>
        )}
      </div>
    </div>
  );
}
