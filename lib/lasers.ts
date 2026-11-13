/**
 * A studio's lasers (sql/lasers_phase1.sql). Every booking is on one laser and
 * every laser has its own working hours (lib/availability.ts). A time is free
 * while at least one laser works then and has nothing booked. Novi Sad has
 * "Stari" (1) and "Novi" (2), Sombor one.
 *
 * Which laser a booking gets is pickFreeLaser() in lib/supabase.ts on the
 * client and free_laser() in the database.
 */

export interface Laser {
  laser: number;
  /** "Stari", "Novi" - shown as "Stari laser" (laserLabel). */
  name: string;
  /** First day it takes bookings ("YYYY-MM-DD"); null = always. */
  active_from: string | null;
}

/**
 * What a studio has until its lasers are loaded, or when they cannot be read
 * (or before sql/lasers_phase1.sql runs): one laser, as before Laser 2.
 * Offering fewer times than there are is the safe side - the database decides.
 */
export const SINGLE_LASER: Laser[] = [{ laser: 1, name: "Laser", active_from: null }];

/** "Stari laser", "Novi laser" - a name that already says "laser" stays as it is. */
export function laserLabel(l: Pick<Laser, "name">): string {
  return /laser/i.test(l.name) ? l.name : `${l.name} laser`;
}

/** The laser has started taking bookings by this date. */
export function isLaserActive(l: Pick<Laser, "active_from">, date: string): boolean {
  return l.active_from === null || l.active_from <= date;
}
