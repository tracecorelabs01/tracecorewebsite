import { NextResponse, type NextRequest } from "next/server";

// Optimistic gate for the admin area: no session cookie → straight to login.
// Real authorisation happens server-side in requireAdmin() on every page/action.
// Also takes a partner's code out of the address (?ref=CODE) before a store page loads.

const SESSION_COOKIE = "tcl_admin";
/** Admin pages a signed-out visitor may open. */
const PUBLIC = new Set(["/admin/login", "/admin/forgot", "/admin/reset"]);
/** Carries a partner code from the redirect to ReferralTracker (which reads it by this name). */
const REF_HANDOFF_COOKIE = "tcl_ref_code";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // A partner's link: the visitor lands on the clean address. ReferralTracker reads the code from this short-lived
  // cookie instead, remembers the partner and counts the click.
  if (!pathname.startsWith("/admin") && !pathname.startsWith("/api") && request.nextUrl.searchParams.has("ref")) {
    const ref = request.nextUrl.searchParams.get("ref") ?? "";
    const url = request.nextUrl.clone();
    url.searchParams.delete("ref");
    const redirect = NextResponse.redirect(url);
    if (/^[A-Za-z0-9_-]{2,32}$/.test(ref)) redirect.cookies.set(REF_HANDOFF_COOKIE, ref, { path: "/", maxAge: 600, sameSite: "lax" });
    return redirect;
  }
  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (pathname.startsWith("/api/admin") && !hasSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (pathname.startsWith("/admin") && !PUBLIC.has(pathname) && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = pathname === "/admin" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "same-origin");
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", { source: "/((?!admin|api|_next).*)", has: [{ type: "query", key: "ref" }] }],
};
