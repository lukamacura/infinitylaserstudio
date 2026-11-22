/** The private admin pages - the public site's chrome (navbar, booking button, toasts) stays off them. */
export function isAdminPath(pathname: string | null | undefined) {
  return /^\/(admin|kartoni|upiti|finances|stats|fnl)(\/|$)/.test(pathname ?? "");
}

/**
 * Pages that bring their own frame: the admin, the client's cancellation page
 * (/otkazivanje) and the gift-box campaign (/paketici - it sells a box, it
 * never books a term) - no navbar, floating "Zakaži" button or "just booked"
 * toast there.
 */
export function hidesSiteChrome(pathname: string | null | undefined) {
  return isAdminPath(pathname) || /^\/(otkazivanje|paketici)(\/|$)/.test(pathname ?? "");
}
