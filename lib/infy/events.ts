/**
 * Fired on window when Infy changed something (a booking, a move, a
 * cancellation, the call list) - the open admin page reloads what it shows.
 */
export const DATA_CHANGED_EVENT = "ils:data-changed";

export function announceDataChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
}
