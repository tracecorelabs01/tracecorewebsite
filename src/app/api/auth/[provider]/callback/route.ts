// Where Discord or Google send someone back after signing in. Checks the state from /start, gets their verified
// email, then signs them in (opening their account) or links the provider to the signed-in account.

import { cookies } from "next/headers";
import { getCurrentCustomer } from "@/lib/auth/customer";
import { afterSignIn, fetchProfile, isProvider, linkProfile, OAUTH_COOKIE, signInWithProfile } from "@/lib/auth/oauth";

// A relative Location keeps people on whichever host they came from.
const goTo = (path: string) => new Response(null, { status: 303, headers: { Location: path } });

export async function GET(req: Request, { params }: RouteContext<"/api/auth/[provider]/callback">) {
  const { provider } = await params;
  const query = new URL(req.url).searchParams;
  const jar = await cookies();
  let saved: { provider?: string; state?: string; next?: string; link?: boolean } = {};
  try {
    saved = JSON.parse(jar.get(OAUTH_COOKIE)?.value ?? "{}");
  } catch {}
  jar.delete({ name: OAUTH_COOKIE, path: "/api/auth" });

  // Linking, and the partner program's Discord-only sign-in, report back to the page they started from.
  const back = afterSignIn(saved.next);
  const failed = saved.link || back.startsWith("/partners") ? `${back}?error=` : "/account/login?error=";
  if (!isProvider(provider) || saved.provider !== provider || !saved.state || query.get("state") !== saved.state) return goTo(`${failed}oauth`);
  const code = query.get("code");
  if (!code) return goTo(`${failed}cancelled`); // they pressed Cancel on the provider's page

  const result = await fetchProfile(provider, code);
  if (!result.ok) return goTo(`${failed}${result.reason === "unverified" ? "unverified" : "oauth"}`);

  if (saved.link) {
    const me = await getCurrentCustomer();
    if (!me) return goTo("/account/login");
    return goTo((await linkProfile(provider, result.profile, me.id)) ? `${back}?linked=${provider}` : `${back}?error=taken`);
  }
  await signInWithProfile(provider, result.profile);
  return goTo(back);
}
