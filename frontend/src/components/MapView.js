// Mapa en tiempo real con estilo limpio tipo navegacion
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import React from "react";
import { GoogleMap, LoadScript, Polyline, OverlayView } from "@react-google-maps/api";
import "./map-styles.css";

// ---------------------------------------------------------------------------
// Helpers de coordenadas
// ---------------------------------------------------------------------------
function toLatLng(coords) {
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const [lat, lng] = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function toLatLngArray(coordsArray) {
  if (!Array.isArray(coordsArray)) return [];
  return coordsArray
    .filter((c) => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]))
    .map(([lat, lng]) => ({ lat, lng }));
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "";
const BUENAVENTURA_CENTER = [3.89243, -77.02824];
const BUENAVENTURA_BOUNDS = { south: 3.84, west: -77.09, north: 3.93, east: -76.99 };
const CORPORATE_ROUTE_COLOR = "#0A2B3D";
const CORPORATE_ROUTE_HALO = "#dbeafe";

const GOOGLE_MAPS_STYLES = [
  { featureType: "all", elementType: "labels.text.fill", stylers: [{ color: "#0f172a" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#e2e8f0" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#f1f5f9" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#bfdbfe" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#f0f9ff" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#e0f2fe" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#dbeafe" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#cbd5e1" }] },
];

const GOOGLE_MAPS_OPTIONS = {
  restriction: { latLngBounds: BUENAVENTURA_BOUNDS, strictBounds: false },
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: false,
  scaleControl: false,
  streetViewControl: false,
  rotateControl: false,
  fullscreenControl: false,
  styles: GOOGLE_MAPS_STYLES,
};

function projectPointOnSegment(point, start, end) {
  const startX = start[1];
  const startY = start[0];
  const endX = end[1];
  const endY = end[0];
  const pointX = point[1];
  const pointY = point[0];
  const dx = endX - startX;
  const dy = endY - startY;
  const segmentLengthSquared = dx * dx + dy * dy;

  if (segmentLengthSquared === 0) {
    const distSquared = (pointX - startX) ** 2 + (pointY - startY) ** 2;
    return { t: 0, distanceSquared: distSquared };
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((pointX - startX) * dx + (pointY - startY) * dy) / segmentLengthSquared,
    ),
  );
  const projectedX = startX + dx * t;
  const projectedY = startY + dy * t;
  const distanceSquared =
    (pointX - projectedX) ** 2 + (pointY - projectedY) ** 2;

  return { t, distanceSquared };
}

function getSegmentRotation(start, end) {
  const deltaLat = end[0] - start[0];
  const deltaLng = end[1] - start[1];
  if (
    !Number.isFinite(deltaLat) ||
    !Number.isFinite(deltaLng) ||
    (deltaLat === 0 && deltaLng === 0)
  ) {
    return 0;
  }
  return Math.atan2(-deltaLat, deltaLng) * (180 / Math.PI);
}

function getVehicleRotation(line, vehiclePoint) {
  if (!Array.isArray(line) || line.length < 2) return 0;

  if (!Array.isArray(vehiclePoint) || vehiclePoint.length !== 2) {
    return getSegmentRotation(line[line.length - 2], line[line.length - 1]);
  }

  let closestSegmentIndex = 0;
  let closestDistanceSquared = Number.POSITIVE_INFINITY;

  for (let index = 0; index < line.length - 1; index += 1) {
    const start = line[index];
    const end = line[index + 1];
    if (!start || !end) continue;

    const { distanceSquared } = projectPointOnSegment(vehiclePoint, start, end);
    if (distanceSquared < closestDistanceSquared) {
      closestDistanceSquared = distanceSquared;
      closestSegmentIndex = index;
    }
  }

  return getSegmentRotation(
    line[closestSegmentIndex],
    line[closestSegmentIndex + 1],
  );
}

function distanceBetweenPoints(from, to) {
  if (!Array.isArray(from) || !Array.isArray(to)) return 0;
  const deltaLat = to[0] - from[0];
  const deltaLng = to[1] - from[1];
  return Math.sqrt(deltaLat * deltaLat + deltaLng * deltaLng);
}

function interpolatePoint(from, to, progress) {
  return [
    from[0] + (to[0] - from[0]) * progress,
    from[1] + (to[1] - from[1]) * progress,
  ];
}

function buildAnimationPath(
  targetPoint,
  traveledLine,
  previousPoint,
  previousLineLength,
) {
  if (Array.isArray(traveledLine) && traveledLine.length > 1) {
    const startIndex =
      previousLineLength > 1 ? Math.max(previousLineLength - 1, 0) : 0;
    const nextPath = traveledLine.slice(startIndex);
    if (Array.isArray(previousPoint) && nextPath.length > 0) {
      if (distanceBetweenPoints(previousPoint, nextPath[0]) > 0.00001) {
        return [previousPoint, ...nextPath];
      }
    }
    return nextPath;
  }

  if (Array.isArray(previousPoint) && Array.isArray(targetPoint)) {
    return [previousPoint, targetPoint];
  }

  return Array.isArray(targetPoint) ? [targetPoint] : [];
}

function totalPathDistance(path) {
  let total = 0;
  for (let index = 1; index < path.length; index += 1) {
    total += distanceBetweenPoints(path[index - 1], path[index]);
  }
  return total;
}

function getPointAtDistance(path, distance) {
  if (path.length === 0) return null;
  if (path.length === 1 || distance <= 0) return path[0];

  let traversed = 0;
  for (let index = 1; index < path.length; index += 1) {
    const start = path[index - 1];
    const end = path[index];
    const segmentDistance = distanceBetweenPoints(start, end);

    if (traversed + segmentDistance >= distance) {
      const localProgress =
        segmentDistance === 0 ? 1 : (distance - traversed) / segmentDistance;
      return interpolatePoint(start, end, localProgress);
    }

    traversed += segmentDistance;
  }

  return path[path.length - 1];
}

function getPoiEmoji(tags = {}) {
  const amenity = (tags.amenity || "").toLowerCase();
  const shop = (tags.shop || "").toLowerCase();
  const leisure = (tags.leisure || "").toLowerCase();

  if (amenity === "university") return "🎓";
  if (amenity === "school") return "🏫";
  if (amenity === "hospital") return "🏥";
  if (amenity === "fuel") return "⛽";
  if (leisure === "park") return "🌳";
  if (shop && /mall|supermarket|department_store/.test(shop)) return "🛍️";

  return "📍";
}

/**
 * @param {Object[]}          trackings         Puntos de tracking del bus.
 * @param {[number,number][]} routePolyline     Coordenadas de la ruta por calles.
 * @param {[number,number]}   originCoords      [lat,lng] del origen.
 * @param {[number,number]}   destinationCoords [lat,lng] del destino.
 * @param {Object[]}          intermediateStops Paradas intermedias con coords.
 * @param {string}            originName        Nombre legible del origen.
 * @param {string}            destinationName   Nombre legible del destino.
 * @param {string}            mapHeight         Altura CSS del mapa (default "560px").
 */
export default function MapView({
  trackings = [],
  routePolyline = null,
  // ETA props: minutos estimados y timestamp de actualización
  eta = null,
  etaUpdated = null,
  plannedRoutePolyline = null,
  remainingRoutePolyline = null,
  traveledRoutePolyline = null,
  originCoords = null,
  destinationCoords = null,
  intermediateStops = [],
  originName = null,
  destinationName = null,
  activeVehicles = [],
  vehiclePosition = null,
  userCoords = null,
  mapHeight = "560px",
  focusAllVehicles = false,
  routeOverlays = [],
  highlightedRouteIds = [],
  pois = [],
}) {
  const [displayPois, setDisplayPois] = useState(Array.isArray(pois) ? pois : []);
  const [animatedVehiclePoint, setAnimatedVehiclePoint] = useState(null);
  const [mapRef, setMapRef] = useState(null);

  const animationFrameRef = useRef(null);
  const animationStartRef = useRef(0);
  const previousAnimatedPointRef = useRef(null);
  const previousTraveledLineLengthRef = useRef(0);
  const poisTimerRef = useRef(null);
  const fittedOnceRef = useRef(false);
  const lastFitLengthRef = useRef(-1);
  const firstFollowRef = useRef(true);
  const containerRef = useRef(null);

  useEffect(() => {
    setDisplayPois(Array.isArray(pois) ? pois : []);
  }, [pois]);

  const validPoints = useMemo(
    () =>
      trackings
        .map((t) => [Number(t.latitude), Number(t.longitude)])
        .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng)),
    [trackings],
  );
  const latestPoint = useMemo(
    () => (validPoints.length > 0 ? validPoints[validPoints.length - 1] : null),
    [validPoints],
  );
  const center = useMemo(
    () =>
      focusAllVehicles
        ? BUENAVENTURA_CENTER
        : latestPoint ||
          originCoords ||
          destinationCoords ||
          userCoords ||
          BUENAVENTURA_CENTER,
    [
      focusAllVehicles,
      latestPoint,
      originCoords,
      destinationCoords,
      userCoords,
    ],
  );
  const loadLocalPois = useCallback(async () => {
    try {
      const res = await fetch("/pois.json");
      if (!res.ok) {
        console.debug("MapView local pois not found (status)", res.status);
        

        return;
      }
      const data = await res.json();
      let parsed = [];
      if (Array.isArray(data)) {
        parsed = data.map((el, i) => ({ id: el.id ?? `local-${i}`, lat: el.lat, lon: el.lon, tags: el.tags || {} }));
      } else if (data.type === "FeatureCollection" && Array.isArray(data.features)) {
        parsed = data.features
          .map((f, i) => {
            const coords = f.geometry?.coordinates;
            if (!coords || coords.length < 2) return null;
            return { id: f.id ?? `local-${i}`, lat: coords[1], lon: coords[0], tags: f.properties || {} };
          })
          .filter(Boolean);
      }
      setDisplayPois(parsed);
      

      console.debug("MapView loaded local POIs:", parsed.length);
    } catch (err) {
      console.debug("MapView error loading local pois:", err);
      

    }
  }, []);

  const fetchPOIs = useCallback(async (lat, lng, radiusMeters = 2000) => {
    try {
      const q = `[out:json][timeout:25];(
  node(around:${radiusMeters},${lat},${lng})[amenity=school];
  node(around:${radiusMeters},${lat},${lng})[amenity=university];
  node(around:${radiusMeters},${lat},${lng})[amenity=hospital];
  node(around:${radiusMeters},${lat},${lng})[amenity=fuel];
  node(around:${radiusMeters},${lat},${lng})[shop~"mall|supermarket|department_store|mall"];
  node(around:${radiusMeters},${lat},${lng})[leisure=park];
);
out center;`;

      const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`;
      console.debug("MapView fetchPOIs url:", url);
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      const parsed = (data.elements || []).map((el) => ({
        id: el.id,
        lat: el.lat ?? el.center?.lat,
        lon: el.lon ?? el.center?.lon,
        tags: el.tags || {},
      }));
      console.debug("MapView fetchPOIs parsed:", parsed.length, parsed.slice(0, 6));
      setDisplayPois(parsed);
      

      console.debug("MapView fetched POIs:", parsed.length);
      if (!parsed.length) {
        console.debug("MapView: Overpass returned 0 elements, attempting local fallback");
        await loadLocalPois();
      }
    } catch (err) {
      console.warn("MapView error fetching POIs:", err);
    }
  }, [loadLocalPois]);

  const plannedLine =
    plannedRoutePolyline?.length > 1
      ? plannedRoutePolyline
      : routePolyline?.length > 1
        ? routePolyline
        : null;
  const remainingLine =
    remainingRoutePolyline?.length > 1 ? remainingRoutePolyline : null;
  const traveledLine =
    traveledRoutePolyline?.length > 1 ? traveledRoutePolyline : null;
  const normalizedRouteOverlays = useMemo(
    () =>
      (Array.isArray(routeOverlays) ? routeOverlays : [])
        .map((overlay) => ({
          ...overlay,
          polyline: Array.isArray(overlay?.polyline)
            ? overlay.polyline.filter(
                (point) =>
                  Array.isArray(point) &&
                  Number.isFinite(point[0]) &&
                  Number.isFinite(point[1]),
              )
            : [],
        }))
        .filter((overlay) => overlay.polyline.length > 1),
    [routeOverlays],
  );
  const normalizedIntermediateStops = useMemo(
    () =>
      (Array.isArray(intermediateStops) ? intermediateStops : [])
        .map((stop, index) => {
          const coords = Array.isArray(stop?.coords)
            ? stop.coords
            : [Number(stop?.latitude), Number(stop?.longitude)];
          if (
            !Array.isArray(coords) ||
            !Number.isFinite(coords[0]) ||
            !Number.isFinite(coords[1])
          )
            return null;

          return {
            id: stop?.id ?? `${index}-${coords.join(",")}`,
            label: stop?.label || `Parada ${index + 1}`,
            address: stop?.address || stop?.label || `Parada ${index + 1}`,
            coords,
            order: index + 1,
          };
        })
        .filter(Boolean),
    [intermediateStops],
  );
  const highlightedRouteIdSet = useMemo(
    () =>
      new Set(
        (Array.isArray(highlightedRouteIds) ? highlightedRouteIds : [])
          .map((routeId) => Number(routeId))
          .filter(Number.isFinite),
      ),
    [highlightedRouteIds],
  );
  const activeVehicleCoords = useMemo(
    () =>
      activeVehicles
        .filter(
          (vehicle) =>
            Number.isFinite(vehicle.latitude) &&
            Number.isFinite(vehicle.longitude),
        )
        .map((vehicle) => [
          Number(vehicle.latitude),
          Number(vehicle.longitude),
        ]),
    [activeVehicles],
  );
  const routeOverlayCoords = normalizedRouteOverlays.flatMap(
    (overlay) => overlay.polyline,
  );

  const fitCoords = useMemo(
    () =>
      focusAllVehicles
        ? [
            ...activeVehicleCoords,
            ...routeOverlayCoords,
            [BUENAVENTURA_BOUNDS.south, BUENAVENTURA_BOUNDS.west],
            [BUENAVENTURA_BOUNDS.north, BUENAVENTURA_BOUNDS.east],
          ]
        : plannedLine?.length > 1
          ? plannedLine
          : traveledLine?.length > 1
            ? traveledLine
            : [
                ...[originCoords, destinationCoords].filter(Boolean),
                ...normalizedIntermediateStops.map((stop) => stop.coords),
                ...[userCoords].filter(Boolean),
                ...activeVehicleCoords,
              ],
    [
      focusAllVehicles,
      activeVehicleCoords,
      routeOverlayCoords,
      plannedLine,
      traveledLine,
      originCoords,
      destinationCoords,
      normalizedIntermediateStops,
      userCoords,
    ],
  );

  const vehiclePoint = useMemo(() => {
    if (
      Number.isFinite(vehiclePosition?.latitude) &&
      Number.isFinite(vehiclePosition?.longitude)
    ) {
      return [
        Number(vehiclePosition.latitude),
        Number(vehiclePosition.longitude),
      ];
    }

    return latestPoint;
  }, [latestPoint, vehiclePosition?.latitude, vehiclePosition?.longitude]);
  const effectiveVehiclePoint = useMemo(
    () => animatedVehiclePoint || vehiclePoint,
    [animatedVehiclePoint, vehiclePoint],
  );

  const hasLiveTrackings = validPoints.length > 0;

  // Debounce POI fetch when vehicle or map changes
  useEffect(() => {
    const coords = Array.isArray(vehiclePoint) ? vehiclePoint : null;
    if (!coords) return undefined;
    if (poisTimerRef.current) clearTimeout(poisTimerRef.current);
    poisTimerRef.current = setTimeout(() => {
      const mapZoom = mapRef?.getZoom ? mapRef.getZoom() : 13;
      const radius = Math.max(600, Math.round(2000 * Math.pow(2, 13 - (mapZoom || 13)) / 4));
      fetchPOIs(coords[0], coords[1], radius);
    }, 1500);
    return () => { if (poisTimerRef.current) clearTimeout(poisTimerRef.current); };
  }, [vehiclePoint, mapRef, fetchPOIs]);

  // FitBounds: ajusta el viewport cuando cambian las coordenadas de la ruta
  useEffect(() => {
    if (!mapRef || !fitCoords?.length) return;
    const freezeAfterFirstFit = !focusAllVehicles && hasLiveTrackings;
    if (freezeAfterFirstFit && fittedOnceRef.current) return;
    if (fitCoords.length === lastFitLengthRef.current) return;
    lastFitLengthRef.current = fitCoords.length;
    const valid = fitCoords.filter(
      (c) => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]),
    );
    if (!valid.length) return;
    if (valid.length === 1) {
      mapRef.setCenter({ lat: valid[0][0], lng: valid[0][1] });
      mapRef.setZoom(15);
      fittedOnceRef.current = true;
      return;
    }
    const bounds = new window.google.maps.LatLngBounds();
    valid.forEach(([lat, lng]) => bounds.extend({ lat, lng }));
    mapRef.fitBounds(bounds, { top: 80, right: 80, bottom: 80, left: 80 });
    fittedOnceRef.current = true;
  }, [mapRef, fitCoords, focusAllVehicles, hasLiveTrackings]);

  // AutoFollowVehicle: centra el mapa en el vehiculo cuando hay trackings en vivo
  useEffect(() => {
    if (!mapRef || !effectiveVehiclePoint || focusAllVehicles || !hasLiveTrackings) return;
    const [lat, lng] = effectiveVehiclePoint;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (firstFollowRef.current) {
      firstFollowRef.current = false;
      mapRef.setCenter({ lat, lng });
      mapRef.setZoom(Math.max(mapRef.getZoom() || 0, 17));
      return;
    }
    mapRef.panTo({ lat, lng });
    if ((mapRef.getZoom() || 0) < 17) mapRef.setZoom(17);
  }, [mapRef, effectiveVehiclePoint, focusAllVehicles, hasLiveTrackings]);

  const primaryVehicle = useMemo(
    () =>
      vehiclePoint
        ? {
            label: activeVehicles[0]?.label || "Vehiculo",
            status: activeVehicles[0]?.status || "En ruta",
            latitude: effectiveVehiclePoint?.[0] ?? vehiclePoint[0],
            longitude: effectiveVehiclePoint?.[1] ?? vehiclePoint[1],
          }
        : null,
    [activeVehicles, effectiveVehiclePoint, vehiclePoint],
  );
  const secondaryVehicles = useMemo(
    () =>
      primaryVehicle
        ? activeVehicles.filter((vehicle, index) => index > 0)
        : activeVehicles,
    [activeVehicles, primaryVehicle],
  );
  const vehicleDirectionLine =
    traveledLine?.length > 1
      ? traveledLine
      : plannedLine?.length > 1
        ? plannedLine
        : validPoints;
  const primaryVehicleRotation = useMemo(
    () =>
      getVehicleRotation(
        vehicleDirectionLine,
        effectiveVehiclePoint || vehiclePoint,
      ),
    [vehicleDirectionLine, effectiveVehiclePoint, vehiclePoint],
  );

  // Calcula distancia total de una línea de coordenadas [lat,lng] en kilómetros
  function lineDistanceKm(line = []) {
    if (!Array.isArray(line) || line.length < 2) return 0;
    const toRad = (v) => (v * Math.PI) / 180;
    const earthKm = 6371;
    let total = 0;
    for (let i = 1; i < line.length; i += 1) {
      const [lat1, lng1] = line[i - 1];
      const [lat2, lng2] = line[i];
      if (!Number.isFinite(lat1) || !Number.isFinite(lng1) || !Number.isFinite(lat2) || !Number.isFinite(lng2)) continue;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lng2 - lng1);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      total += earthKm * c;
    }
    return total;
  }

  const plannedKm = Math.round((plannedLine?.length > 1 ? lineDistanceKm(plannedLine) : 0) * 10) / 10;
  const traveledKm = Math.round((traveledLine?.length > 1 ? lineDistanceKm(traveledLine) : 0) * 10) / 10;
  const pendingKm = Math.round(Math.max(0, plannedKm - traveledKm) * 10) / 10;

  useEffect(() => {
    if (!Array.isArray(vehiclePoint)) return undefined;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const animationPath = buildAnimationPath(
      vehiclePoint,
      traveledLine,
      previousAnimatedPointRef.current,
      previousTraveledLineLengthRef.current,
    );
    previousTraveledLineLengthRef.current = Array.isArray(traveledLine)
      ? traveledLine.length
      : 0;

    if (animationPath.length <= 1) {
      setAnimatedVehiclePoint(vehiclePoint);
      previousAnimatedPointRef.current = vehiclePoint;
      return undefined;
    }

    const pathDistance = totalPathDistance(animationPath);
    const duration = Math.min(1800, Math.max(700, animationPath.length * 18));
    animationStartRef.current = 0;

    const animate = (timestamp) => {
      if (!animationStartRef.current) {
        animationStartRef.current = timestamp;
      }

      const elapsed = timestamp - animationStartRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = 1 - (1 - progress) * (1 - progress);
      const nextPoint =
        getPointAtDistance(animationPath, pathDistance * easedProgress) ||
        vehiclePoint;
      setAnimatedVehiclePoint(nextPoint);
      previousAnimatedPointRef.current = nextPoint;

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      setAnimatedVehiclePoint(vehiclePoint);
      previousAnimatedPointRef.current = vehiclePoint;
      animationFrameRef.current = null;
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [traveledLine, vehiclePoint]);

  useEffect(
    () => () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    },
    [],
  );

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", height: mapHeight }}
      className="tracking-map-container"
    >
      <LoadScript
        googleMapsApiKey={GOOGLE_MAPS_API_KEY}
        loadingElement={<div style={{ height: "100%", background: "#f0f9ff" }} />}
      >
        <GoogleMap
          mapContainerStyle={{ height: "100%", width: "100%" }}
          center={toLatLng(center) || { lat: BUENAVENTURA_CENTER[0], lng: BUENAVENTURA_CENTER[1] }}
          zoom={focusAllVehicles ? 12 : 14}
          onLoad={(map) => setMapRef(map)}
          options={GOOGLE_MAPS_OPTIONS}
        >
          {/* ---- Rutas superpuestas (modo admin / focus all) ---- */}
          {normalizedRouteOverlays.map((overlay) => {
            const isHighlighted = highlightedRouteIdSet.has(Number(overlay.id));
            const isDimmed = highlightedRouteIdSet.size > 0 && !isHighlighted;
            const path = toLatLngArray(overlay.polyline);
            return (
              <React.Fragment key={`route-overlay-${overlay.id}`}>
                <Polyline
                  path={path}
                  options={{
                    strokeColor: isHighlighted ? "#93c5fd" : CORPORATE_ROUTE_HALO,
                    strokeWeight: isHighlighted ? 6 : 5,
                    strokeOpacity: isDimmed ? 0.06 : 0.18,
                  }}
                />
                <Polyline
                  path={path}
                  options={{
                    strokeColor: CORPORATE_ROUTE_COLOR,
                    strokeWeight: 3,
                    strokeOpacity: isDimmed ? 0.16 : 0.7,
                  }}
                />
              </React.Fragment>
            );
          })}

          {/* ---- Ruta planificada ---- */}
          {plannedLine?.length > 1 && !remainingLine && (
            <>
              <Polyline
                path={toLatLngArray(plannedLine)}
                options={{ strokeColor: CORPORATE_ROUTE_HALO, strokeWeight: 6, strokeOpacity: 0.18 }}
              />
              <Polyline
                path={toLatLngArray(plannedLine)}
                options={{ strokeColor: CORPORATE_ROUTE_COLOR, strokeWeight: 4, strokeOpacity: 0.95 }}
              />
            </>
          )}

          {/* ---- Tramo restante ---- */}
          {remainingLine?.length > 1 && (
            <>
              <Polyline
                path={toLatLngArray(remainingLine)}
                options={{ strokeColor: "#0891b2", strokeWeight: 6, strokeOpacity: 0.18 }}
              />
              <Polyline
                path={toLatLngArray(remainingLine)}
                options={{
                  strokeColor: "#0891b2",
                  strokeWeight: 4,
                  strokeOpacity: 0.95,
                  icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 4 }, offset: "0", repeat: "15px" }],
                }}
              />
            </>
          )}

          {/* ---- Tramo recorrido ---- */}
          {traveledLine?.length > 1 && (
            <>
              <Polyline
                path={toLatLngArray(traveledLine)}
                options={{ strokeColor: CORPORATE_ROUTE_HALO, strokeWeight: 6, strokeOpacity: 0.14 }}
              />
              <Polyline
                path={toLatLngArray(traveledLine)}
                options={{ strokeColor: "#2563eb", strokeWeight: 5, strokeOpacity: 0.98 }}
              />
            </>
          )}

          {/* ---- Origen ---- */}
          {toLatLng(originCoords) && (
            <OverlayView position={toLatLng(originCoords)} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
              <div style={{ transform: "translate(-50%, -50%)", pointerEvents: "none" }}>
                <div className="vt-route-point vt-route-point-start" />
              </div>
            </OverlayView>
          )}

          {/* ---- Paradas intermedias ---- */}
          {normalizedIntermediateStops.map((stop) => (
            <OverlayView
              key={`stop-${stop.id}`}
              position={toLatLng(stop.coords)}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            >
              <div style={{ transform: "translate(-50%, -50%)", pointerEvents: "none" }}>
                <div className="vt-route-stop-marker">
                  <span className="vt-route-stop-ring" />
                  <span className="vt-route-stop-core">{stop.order}</span>
                </div>
              </div>
            </OverlayView>
          ))}

          {/* ---- Destino ---- */}
          {toLatLng(destinationCoords) && (
            <OverlayView position={toLatLng(destinationCoords)} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
              <div style={{ transform: "translate(-50%, -50%)", pointerEvents: "none" }}>
                <div className="vt-route-point vt-route-point-end" />
              </div>
            </OverlayView>
          )}

          {/* ---- Vehículo principal ---- */}
          {primaryVehicle && toLatLng([primaryVehicle.latitude, primaryVehicle.longitude]) && (
            <>
              <OverlayView
                position={{ lat: primaryVehicle.latitude, lng: primaryVehicle.longitude }}
                mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
              >
                <div style={{ transform: "translate(-50%, -50%)", pointerEvents: "none" }}>
                  <div
                    className="vt-current-point-ring"
                    style={{ width: 28, height: 28, borderRadius: "50%", border: "6px solid rgba(37,99,235,0.18)" }}
                  />
                </div>
              </OverlayView>
              <OverlayView
                position={{ lat: primaryVehicle.latitude, lng: primaryVehicle.longitude }}
                mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
              >
                <div style={{ transform: "translate(-50%, -50%)", pointerEvents: "none" }}>
                  <div
                    className="vt-current-point-core"
                    style={{ width: 12, height: 12, borderRadius: "50%", background: "#2563eb", border: "3px solid #ffffff" }}
                  />
                </div>
              </OverlayView>
              <OverlayView
                position={{ lat: primaryVehicle.latitude, lng: primaryVehicle.longitude }}
                mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
              >
                <div style={{ transform: "translate(-50%, calc(-100% - 14px))", pointerEvents: "none" }}>
                  <div className={`vt-vehicle-chip vt-vehicle-chip-${primaryVehicle.status === "En ruta" ? "moving" : "idle"}`}>
                    <span className="vt-vehicle-icon" style={{ transform: `rotate(${primaryVehicleRotation}deg)` }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="1" y="4" width="16" height="12" rx="2" />
                        <path d="M17 8h3l3 4v4h-6V8z" />
                        <circle cx="5.5" cy="18.5" r="2.2" />
                        <circle cx="18.5" cy="18.5" r="2.2" />
                      </svg>
                    </span>
                    <span className="vt-vehicle-text">{primaryVehicle.label || "Vehiculo"}</span>
                  </div>
                </div>
              </OverlayView>
            </>
          )}

          {/* ---- Vehículos secundarios ---- */}
          {secondaryVehicles.map((vehicle) => {
            if (!Number.isFinite(vehicle.latitude) || !Number.isFinite(vehicle.longitude)) return null;
            return (
              <OverlayView
                key={`${vehicle.label}-${vehicle.latitude}-${vehicle.longitude}`}
                position={{ lat: vehicle.latitude, lng: vehicle.longitude }}
                mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
              >
                <div style={{ transform: "translate(-50%, calc(-100% - 14px))", pointerEvents: "none" }}>
                  <div className={`vt-vehicle-chip vt-vehicle-chip-${vehicle.status === "En ruta" ? "moving" : "idle"}`}>
                    <span className="vt-vehicle-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="1" y="4" width="16" height="12" rx="2" />
                        <path d="M17 8h3l3 4v4h-6V8z" />
                        <circle cx="5.5" cy="18.5" r="2.2" />
                        <circle cx="18.5" cy="18.5" r="2.2" />
                      </svg>
                    </span>
                    <span className="vt-vehicle-text">{vehicle.label || "Vehiculo"}</span>
                  </div>
                </div>
              </OverlayView>
            );
          })}

          {/* ---- POIs ---- */}
          {Array.isArray(displayPois) &&
            displayPois.map((p) => {
              const lat = Number(p.lat);
              const lon = Number(p.lon);
              if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
              return (
                <OverlayView
                  key={`poi-${p.id}`}
                  position={{ lat, lng: lon }}
                  mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                >
                  <div style={{ transform: "translate(-50%, -50%)", pointerEvents: "none" }}>
                    <div className="vt-poi-marker">{getPoiEmoji(p.tags || {})}</div>
                  </div>
                </OverlayView>
              );
            })}

          {/* ---- Etiqueta de origen ---- */}
          {toLatLng(originCoords) && (
            <OverlayView position={toLatLng(originCoords)} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
              <div style={{ transform: "translate(14px, -28px)", pointerEvents: "none" }}>
                <div className="vt-route-chip vt-route-chip-start">
                  <span className="vt-route-chip-text">{originName || "Origen"}</span>
                  <span className="vt-route-chip-arrow">›</span>
                </div>
              </div>
            </OverlayView>
          )}

          {/* ---- Etiqueta de destino ---- */}
          {toLatLng(destinationCoords) && (
            <OverlayView position={toLatLng(destinationCoords)} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
              <div style={{ transform: "translate(calc(-100% - 14px), -28px)", pointerEvents: "none" }}>
                <div className="vt-route-chip vt-route-chip-end">
                  <span className="vt-route-chip-text">{destinationName || "Destino"}</span>
                  <span className="vt-route-chip-arrow">›</span>
                </div>
              </div>
            </OverlayView>
          )}
        </GoogleMap>
      </LoadScript>


      {/* ---- Panel flotante ETA ---- */}
      <div
        className={`floating-eta ${eta === null ? "floating-eta-hidden" : ""}`}
        aria-live="polite"
      >
        <div className="floating-eta-main">
          <div className="floating-eta-label">ETA</div>
          <div className="floating-eta-value">{eta === null ? "Sin datos" : `${eta} min`}</div>
        </div>
        {etaUpdated && (
          <div className="floating-eta-updated">
            Actualizado:{" "}
            {new Date(etaUpdated).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
          </div>
        )}
      </div>

      {/* ---- Métricas de ruta ---- */}
      <div className="route-metrics-panel">
        <div className="route-metrics-grid">
          <div className="route-metric-tile">
            <span className="route-metric-label">Planif.</span>
            <span className="route-metric-value">{plannedKm} km</span>
          </div>
          <div className="route-metric-tile">
            <span className="route-metric-label">Recorr.</span>
            <span className="route-metric-value">{traveledKm} km</span>
          </div>
          <div className="route-metric-tile">
            <span className="route-metric-label">Pend.</span>
            <span className="route-metric-value">{pendingKm} km</span>
          </div>
        </div>
      </div>

      {/* ---- Leyenda ---- */}
      <div className="map-legend">
        <div className="legend-title">Leyenda</div>
        {primaryVehicle && (
          <div className="legend-item">
            <div className="legend-marker current-dot" />
            <span>Punto actual</span>
          </div>
        )}
        {originCoords && (
          <div className="legend-item">
            <div className="legend-marker origin-dot" />
            <span>Origen</span>
          </div>
        )}
        {destinationCoords && (
          <div className="legend-item">
            <div className="legend-marker destination-dot" />
            <span>Destino</span>
          </div>
        )}
        {normalizedIntermediateStops.length > 0 && (
          <div className="legend-item">
            <div className="legend-marker stop-dot" />
            <span>Paradas intermedias</span>
          </div>
        )}
        {remainingLine?.length > 1 ? (
          <div className="legend-item">
            <div className="legend-line remaining" />
            <span>Tramo restante</span>
          </div>
        ) : (
          plannedLine?.length > 1 && (
            <div className="legend-item">
              <div className="legend-line planned" />
              <span>Ruta planificada</span>
            </div>
          )
        )}
        {traveledLine?.length > 1 && (
          <div className="legend-item">
            <div className="legend-line traveled" />
            <span>Tramo recorrido</span>
          </div>
        )}
        {focusAllVehicles && normalizedRouteOverlays.length > 0 && (
          <div className="legend-item">
            <div className="legend-line planned" />
            <span>Rutas monitoreadas</span>
          </div>
        )}
        {focusAllVehicles && highlightedRouteIdSet.size > 0 && (
          <div className="legend-item">
            <div className="legend-line traveled" />
            <span>Rutas resaltadas</span>
          </div>
        )}
      </div>
    </div>
  );
}


