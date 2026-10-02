/**
 * Studios under the Infinity Laser Studio brand. The `id` is what the database
 * stores in every `location` column (see sql/locations_phase1.sql) - every
 * reservation, working-hours row and ad-spend row belongs to exactly one studio.
 * The price list (`services`) is shared by all of them.
 */
import type { CSSProperties } from "react";

export type LocationId = "novi_sad" | "sombor";

/**
 * A studio's colours in the admin panel. Each studio gets its own accent and
 * its own tint of the dark background, so it is obvious at a glance which
 * calendar is open. The public site always stays on rose gold.
 * The admin is looked at for hours, so these are softer than the public
 * palette: charcoal instead of near-black, off-white text, muted accents.
 */
export interface LocationPalette {
  accent: string;
  accentSoft: string;
  accentDeep: string;
  /** Text and icons on top of an accent fill. */
  onAccent: string;
  background: string;
  backgroundAlt: string;
  surface: string;
  surfaceRaised: string;
  foreground: string;
}

export interface StudioLocation {
  id: LocationId;
  /** City, as shown on cards and in the admin switcher. */
  name: string;
  /** "u Novom Sadu" - the city in the locative case, for running text. */
  cityLocative: string;
  /** Street + number; null until the studio has one to show. */
  address: string | null;
  /** Round picture on the location card; null falls back to a map pin. */
  image: string | null;
  /** Google Maps embed; null hides the map. */
  mapEmbed: string | null;
  palette: LocationPalette;
}

/** Rows that predate the second studio all belong here. */
export const DEFAULT_LOCATION: LocationId = "novi_sad";

export const LOCATIONS: readonly StudioLocation[] = [
  {
    id: "novi_sad",
    name: "Novi Sad",
    cityLocative: "u Novom Sadu",
    address: "Miloja Čiplića 51",
    image: "/lokacije/novi_sad.webp",
    mapEmbed:
      "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2808.952530282901!2d19.795792112493817!3d45.248752670950566!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x475b116b6f148971%3A0xbae20345f88572f7!2sInfinity%20Laser%20Studio!5e0!3m2!1sen!2srs!4v1775850629842!5m2!1sen!2srs",
    // Warm charcoal + rose gold - the brand palette, toned down.
    palette: {
      accent: "#D4A9A7",
      accentSoft: "#E3C4C1",
      accentDeep: "#9E6F70",
      onAccent: "#241A1E",
      background: "#1C1619",
      backgroundAlt: "#211A1E",
      surface: "#282024",
      surfaceRaised: "#342A2F",
      foreground: "#E8DDDD",
    },
  },
  {
    id: "sombor",
    name: "Sombor",
    cityLocative: "u Somboru",
    address: "JNA 30",
    image: "/lokacije/sombor.webp",
    mapEmbed: null,
    // Slate indigo + lavender - cool where Novi Sad is warm, and clear of the
    // status colours (green, amber, red) used across the calendar.
    palette: {
      accent: "#B5A9DB",
      accentSoft: "#CFC7EA",
      accentDeep: "#7A6DA6",
      onAccent: "#1A1724",
      background: "#17151D",
      backgroundAlt: "#1B1922",
      surface: "#22202B",
      surfaceRaised: "#2D2A38",
      foreground: "#E2DEEA",
    },
  },
];

export function getLocation(id: LocationId): StudioLocation {
  return LOCATIONS.find((l) => l.id === id) ?? LOCATIONS[0];
}

export function isLocationId(value: unknown): value is LocationId {
  return LOCATIONS.some((l) => l.id === value);
}

/** "Miloja Čiplića 51, Novi Sad" - or just the city while the address is unknown. */
export function fullAddress(loc: StudioLocation): string {
  return loc.address ? `${loc.address}, ${loc.name}` : loc.name;
}

/**
 * Inline style that re-points the theme variables (see globals.css) to one
 * studio's palette. Put it on the root of an admin page - everything inside
 * that uses `accent`, `surface`, `background` or `foreground` follows. Pair it
 * with the `admin-theme` class (globals.css), which softens the status colours.
 */
export function locationTheme(id: LocationId): CSSProperties {
  const p = getLocation(id).palette;
  return {
    "--accent": p.accent,
    "--accent-soft": p.accentSoft,
    "--accent-deep": p.accentDeep,
    "--on-accent": p.onAccent,
    "--background": p.background,
    "--background-alt": p.backgroundAlt,
    "--surface": p.surface,
    "--surface-raised": p.surfaceRaised,
    "--foreground": p.foreground,
  } as CSSProperties;
}
