/**
 * The unauthenticated surface, kept in one tested place.
 *
 * Everything else in the app collapses to a login redirect, so adding a route
 * that must work *before* anyone is signed in means adding it here too. That is
 * easy to forget — `/api/regions` shipped without it and the login picker could
 * not load its own dropdowns, because the middleware answered the fetch with a
 * 307 to /poc rather than JSON.
 */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/api/login" ||
    // The login picker's region/hub lists (Decision 0020): an admin has to pick
    // a hub before they can prove who they are. It carries the office's own
    // structure and nothing else — no counts, no account state, no partner data.
    pathname === "/api/regions" ||
    // The cash form's public surface: the page itself plus the no-login
    // dropdown + submit endpoints it calls. The form is an intake — there is
    // no session to gate on, so the middleware must let it through.
    pathname === "/cash" ||
    pathname === "/api/cash/regions" ||
    pathname === "/api/cash/hubs" ||
    pathname === "/api/cash/churches" ||
    pathname === "/api/cash/submit"
  );
}
