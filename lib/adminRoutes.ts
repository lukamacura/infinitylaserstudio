/** The private admin pages - the public site's chrome (navbar, booking button, toasts) stays off them. */
export function isAdminPath(pathname: string | null | undefined) {
  return /^\/(admin|finances|stats|fnl)(\/|$)/.test(pathname ?? "");
}
