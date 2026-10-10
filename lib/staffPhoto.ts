// Kept apart from lib/staff.ts so the landing page can show staff photos
// without pulling in the Supabase client.

/**
 * Photos in /public/team, by lowercased first name ("dr " kept for the doctor,
 * so a plain "Ana" on staff doesn't get Dr Ana's photo). Anyone without one gets their initial.
 */
const STAFF_PHOTOS: Record<string, string> = {
  "dr ana": "/team/ana.webp",
  branka: "/team/branka.webp",
  mila: "/team/mila.webp",
  tanja: "/team/tanja.webp",
};

/** Doctor titles, normalised to "dr" ("Dr Ana Kasap" → "dr ana", "Ana" → "ana"). */
const TITLES = new Set(["dr", "dr.", "др", "др."]);

export function staffPhoto(name: string): string | null {
  const words = name.trim().toLowerCase().split(/\s+/);
  const titled = TITLES.has(words[0]);
  const first = titled ? words[1] : words[0];
  const key = titled && first ? `dr ${first}` : first;
  return (key && STAFF_PHOTOS[key]) ?? null;
}
