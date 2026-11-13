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

const LASER_KEY = "ils_admin_laser";

/**
 * The laser the admin calendar shows, in a studio with more than one (Novi Sad:
 * 1 = Stari, 2 = Novi). Remembered like the studio. A studio that does not have
 * the saved laser shows its first one - see the admin page.
 */
export function useAdminLaser() {
  const [laser, setLaserState] = useState(1);

  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(LASER_KEY));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (Number.isInteger(saved) && saved >= 1) setLaserState(saved);
    } catch { /* storage unavailable - stay on the first laser */ }
  }, []);

  function setLaser(next: number) {
    setLaserState(next);
    try { window.localStorage.setItem(LASER_KEY, String(next)); } catch { /* ignore */ }
  }

  return { laser, setLaser };
}
