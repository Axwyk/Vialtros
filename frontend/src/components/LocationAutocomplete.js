import React, { useCallback, useEffect, useRef, useState } from "react";
import { useGoogleMaps } from "../context/GoogleMapsContext";
import "./location-autocomplete.css";

// Buenaventura, Valle del Cauca — bias de búsqueda local sin restringir resultados globales
const BIAS_LAT = 3.8801;
const BIAS_LNG = -77.0311;
const BIAS_RADIUS_M = 150000; // 150 km cubre Valle del Cauca y alrededores

function getPlaceIcon(types) {
  if (!types) return "pin";
  if (types.some((t) => t === "airport")) return "airport";
  if (types.some((t) => ["hospital", "health"].includes(t))) return "hospital";
  if (types.some((t) => ["school", "university"].includes(t))) return "school";
  if (types.some((t) => ["transit_station", "bus_station", "train_station"].includes(t))) return "transit";
  if (types.some((t) => ["locality", "administrative_area_level_1", "country", "political"].includes(t))) return "city";
  if (types.some((t) => ["route", "street_address", "premise"].includes(t))) return "street";
  if (types.some((t) => ["establishment", "point_of_interest"].includes(t))) return "building";
  return "pin";
}

const ICONS = {
  pin: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  ),
  street: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  city: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  ),
  airport: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21 4 19 4c-2 0-4 2-4 2L7 5.8l-1.4 1.4 4.8 2.4-2.4 2.4-2-1-1.4 1.4 3.5 3.5L3 20l1 1 6.5-4.5 3.5 3.5 1.4-1.4-1-2z"/>
    </svg>
  ),
  hospital: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <line x1="12" y1="8" x2="12" y2="16"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
    </svg>
  ),
  school: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
      <path d="M6 12v5c3 3 9 3 12 0v-5"/>
    </svg>
  ),
  transit: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" rx="2"/>
      <path d="M16 8h4l3 3v3h-7V8z"/>
      <circle cx="5.5" cy="18.5" r="2.5"/>
      <circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  ),
  building: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/>
      <path d="M9 22V12h6v10"/>
      <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01"/>
    </svg>
  ),
};

function extractAddressComponents(components) {
  const get = (type) =>
    components?.find((c) => c.types.includes(type))?.long_name ?? "";
  return {
    city: get("locality") || get("administrative_area_level_2"),
    state: get("administrative_area_level_1"),
    country: get("country"),
  };
}

export default function LocationAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Buscar dirección o lugar...",
  label,
  required = false,
  disabled = false,
}) {
  const { isLoaded } = useGoogleMaps();
  const [predictions, setPredictions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isFocused, setIsFocused] = useState(false);

  const autocompleteServiceRef = useRef(null);
  const placesServiceRef = useRef(null);
  const sessionTokenRef = useRef(null);
  const dummyDivRef = useRef(null);
  const debounceRef = useRef(null);
  const requestIdRef = useRef(0);
  // Bloquea búsquedas disparadas por cambios de value que vienen de una selección
  const isSelectingRef = useRef(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Inicializar servicios de Google Places cuando la API cargue
  useEffect(() => {
    if (!isLoaded || !window.google?.maps?.places) return;
    autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
    if (dummyDivRef.current) {
      placesServiceRef.current = new window.google.maps.places.PlacesService(dummyDivRef.current);
    }
    sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
  }, [isLoaded]);

  // Buscar predicciones — SOLO cuando el input tiene el foco y el usuario está escribiendo
  useEffect(() => {
    clearTimeout(debounceRef.current);

    // No buscar si el campo no está enfocado o si el cambio vino de una selección
    if (!isFocused || isSelectingRef.current) {
      setIsLoading(false);
      return;
    }

    if (!isLoaded || !autocompleteServiceRef.current || !value || value.length < 1) {
      setPredictions([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    const currentId = ++requestIdRef.current;
    setIsLoading(true);

    debounceRef.current = setTimeout(() => {
      const request = {
        input: value,
        sessionToken: sessionTokenRef.current,
      };

      // Bias hacia Buenaventura sin restringir resultados globales
      if (window.google?.maps?.LatLng) {
        request.location = new window.google.maps.LatLng(BIAS_LAT, BIAS_LNG);
        request.radius = BIAS_RADIUS_M;
      }

      autocompleteServiceRef.current.getPlacePredictions(request, (results, status) => {
        if (currentId !== requestIdRef.current) return;
        setIsLoading(false);
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
          setPredictions(results);
          setIsOpen(true);
          setActiveIndex(-1);
        } else {
          setPredictions([]);
          setIsOpen(false);
        }
      });
    }, 200);

    return () => clearTimeout(debounceRef.current);
  }, [value, isLoaded, isFocused]);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setActiveIndex(-1);
        setIsFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (prediction) => {
      // Bloquear búsquedas mientras se procesa la selección
      isSelectingRef.current = true;
      setIsOpen(false);
      setActiveIndex(-1);
      setPredictions([]);

      const mainText = prediction.structured_formatting?.main_text ?? prediction.description;
      // Actualizar input con el texto principal inmediatamente (feedback visual)
      onChange(mainText);

      if (!placesServiceRef.current) {
        isSelectingRef.current = false;
        return;
      }

      placesServiceRef.current.getDetails(
        {
          placeId: prediction.place_id,
          fields: ["name", "formatted_address", "geometry", "address_components", "types"],
          sessionToken: sessionTokenRef.current,
        },
        (place, status) => {
          if (status !== window.google.maps.places.PlacesServiceStatus.OK || !place) {
            isSelectingRef.current = false;
            return;
          }

          const { city, state, country } = extractAddressComponents(place.address_components);
          onSelect({
            name: place.name ?? mainText,
            address: place.formatted_address ?? mainText,
            lat: place.geometry?.location?.lat() ?? null,
            lng: place.geometry?.location?.lng() ?? null,
            placeId: prediction.place_id,
            city,
            state,
            country,
          });

          if (window.google?.maps?.places?.AutocompleteSessionToken) {
            sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
          }

          // Liberar bloqueo después de que React procese los cambios de estado de onSelect
          setTimeout(() => {
            isSelectingRef.current = false;
          }, 300);
        },
      );
    },
    [onChange, onSelect],
  );

  const handleFocus = () => {
    setIsFocused(true);
    // Si ya hay predicciones cargadas, volver a mostrarlas
    if (predictions.length > 0) {
      setIsOpen(true);
    }
  };

  const handleBlur = () => {
    // No cerrar aquí — lo maneja el click-outside para no interferir con clicks en sugerencias
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen && predictions.length > 0) setIsOpen(true);
      else setActiveIndex((i) => Math.min(i + 1, predictions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (isOpen && activeIndex >= 0 && predictions[activeIndex]) {
        handleSelect(predictions[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  const inputEl = (
    <div className="lac-input-wrapper">
      <span className="lac-input-icon">{ICONS.pin}</span>
      <input
        ref={inputRef}
        type="text"
        className="lac-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        required={required}
        disabled={disabled}
        aria-autocomplete="list"
        aria-expanded={isOpen}
      />
      {isLoading && (
        <span className="lac-spinner" aria-label="Buscando...">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
        </span>
      )}
    </div>
  );

  return (
    <div ref={containerRef} className="lac-container">
      <div ref={dummyDivRef} style={{ display: "none" }} />
      {label ? (
        <label className="lac-label">
          {label}
          {required && <span className="lac-required"> *</span>}
          {inputEl}
        </label>
      ) : (
        inputEl
      )}
      {isOpen && predictions.length > 0 && (
        <div className="lac-dropdown" role="listbox">
          {predictions.map((prediction, index) => {
            const iconKey = getPlaceIcon(prediction.types);
            const main = prediction.structured_formatting?.main_text;
            const secondary = prediction.structured_formatting?.secondary_text;
            return (
              <button
                key={prediction.place_id}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={`lac-item${index === activeIndex ? " lac-item--active" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(prediction)}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <span className="lac-item-icon">{ICONS[iconKey] ?? ICONS.pin}</span>
                <span className="lac-item-text">
                  <span className="lac-item-main">{main ?? prediction.description}</span>
                  {secondary && <span className="lac-item-secondary">{secondary}</span>}
                </span>
              </button>
            );
          })}
          <div className="lac-attribution">
            <svg height="10" viewBox="0 0 120 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Powered by Google">
              <text x="0" y="11" fontSize="10" fill="#9ca3af" fontFamily="Arial, sans-serif">Powered by Google</text>
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
