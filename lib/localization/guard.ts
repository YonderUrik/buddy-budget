import "server-only";
import { auth } from "@/lib/auth";
import { COUNTRY_UNAVAILABLE_MESSAGE, isCountryPathAvailable, resolveProfile, type LocaleProfile } from "./config";
import { translate } from "./messages";

/** The coded 403 of a feature the product country does not have (same body as the proxy's). */
export function countryUnavailableResponse(profile: LocaleProfile): Response {
  return Response.json({ code: "country_feature_unavailable", error: translate(profile.language, COUNTRY_UNAVAILABLE_MESSAGE) }, { status: 403 });
}
/** Defence in depth: enforce country capabilities even when handlers are invoked without the proxy. */
export function withCountryGuard<R extends Request, A extends unknown[]>(handler: (request: R, ...args: A) => Promise<Response> | Response) {
  return async (request: R, ...args: A): Promise<Response> => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return new Response(null, { status: 401 });
    const profile = resolveProfile(session.user);
    if (!isCountryPathAvailable(profile.productCountry, new URL(request.url).pathname)) {
      return countryUnavailableResponse(profile);
    }
    return handler(request, ...args);
  };
}
