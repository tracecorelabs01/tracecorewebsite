// Sends someone to Discord or Google to sign in. ?next= is where to return to (checkout, an account or partner page);
// ?link=1 links the provider to the signed-in account instead of signing in (the Connect Discord buttons).

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { cookieIsSecure } from "@/lib/auth/session";
import { afterSignIn, authorizeUrl, isProvider, OAUTH_COOKIE, oauthEnabled } from "@/lib/auth/oauth";

export async function GET(req: Request, { params }: RouteContext<"/api/auth/[provider]/start">) {
  const { provider } = await params;
  if (!isProvider(provider) || !oauthEnabled(provider)) return new Response(null, { status: 303, headers: { Location: "/account/login?error=oauth" } });

  const query = new URL(req.url).searchParams;
  // A random state ties the callback to this browser, so nobody can sign someone in as themselves.
  const state = randomBytes(24).toString("base64url");
  const saved = { provider, state, next: afterSignIn(query.get("next")), link: query.get("link") === "1" };
  (await cookies()).set(OAUTH_COOKIE, JSON.stringify(saved), { httpOnly: true, secure: await cookieIsSecure(), sameSite: "lax", path: "/api/auth", maxAge: 600 });
  return Response.redirect(authorizeUrl(provider, state), 303);
}
