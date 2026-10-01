"use client";

import { useEffect, useState } from "react";
import { DEFAULT_LOCATION, isLocationId, type LocationId } from "./locations";

const STORAGE_KEY = "ils_admin_location";

/**
 * The studio the admin is currently looking at. Shared by /admin, /finances and
 * /stats through localStorage, so switching once carries across all three.
 */
export function useAdminLocation() {
  const [location, setLocationState] = useState<LocationId>(DEFAULT_LOCATION);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (isLocationId(saved)) setLocationState(saved);
    } catch { /* storage unavailable - stay on the default */ }
  }, []);

  function setLocation(next: LocationId) {
    setLocationState(next);
    try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
  }

  return { location, setLocation };
}
