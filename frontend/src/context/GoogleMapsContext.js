import React, { createContext, useContext, useEffect, useState } from "react";
import { useJsApiLoader } from "@react-google-maps/api";

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "";
const GOOGLE_MAPS_MAP_ID = process.env.REACT_APP_GOOGLE_MAPS_MAP_ID || "";

// Stable reference at module level — never recreated between renders
const GOOGLE_MAPS_LIBRARIES = ["places"];

const GoogleMapsContext = createContext({ isLoaded: false, loadError: null, authError: false });

export function GoogleMapsProvider({ children }) {
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    window.gm_authFailure = () => setAuthError(true);
    return () => { delete window.gm_authFailure; };
  }, []);

  const { isLoaded, loadError } = useJsApiLoader({
    id: "vialtros-google-map",
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
    version: "weekly",
    mapIds: GOOGLE_MAPS_MAP_ID ? [GOOGLE_MAPS_MAP_ID] : undefined,
  });


  return (
    <GoogleMapsContext.Provider value={{ isLoaded, loadError, authError }}>
      {children}
    </GoogleMapsContext.Provider>
  );
}

export function useGoogleMaps() {
  return useContext(GoogleMapsContext);
}
