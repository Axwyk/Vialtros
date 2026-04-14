import { useEffect, useState } from "react";
import {
  getDriverAssignedRoutes,
  getUserAssignedRoute,
} from "../../services/dashboard";
import { getRoutes } from "../../services/admin";

const DEFAULT_TRACKING_STATE = {
  trackingLink: "/tracking/1",
  trackingEnabled: false,
};

async function resolveTrackingRouteId(role) {
  if (role === "driver") {
    const routes = await getDriverAssignedRoutes();
    return routes?.[0]?.id ?? null;
  }

  if (role === "user") {
    const payload = await getUserAssignedRoute();
    return payload?.route?.id ?? null;
  }

  if (role === "admin") {
    const routes = await getRoutes();
    return routes?.[0]?.id ?? null;
  }

  return null;
}

export default function useTrackingRoute(role) {
  const [trackingState, setTrackingState] = useState(DEFAULT_TRACKING_STATE);

  useEffect(() => {
    let mounted = true;

    async function loadTrackingRoute() {
      try {
        const routeId = await resolveTrackingRouteId(role);
        if (!mounted) return;

        if (routeId) {
          setTrackingState({
            trackingLink: `/tracking/${routeId}`,
            trackingEnabled: true,
          });
          return;
        }

        setTrackingState(DEFAULT_TRACKING_STATE);
      } catch {
        if (mounted) {
          setTrackingState(DEFAULT_TRACKING_STATE);
        }
      }
    }

    void loadTrackingRoute();

    return () => {
      mounted = false;
    };
  }, [role]);

  return trackingState;
}
