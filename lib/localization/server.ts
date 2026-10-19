import "server-only";
import { cache } from "react";
import { headers, cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { LANGUAGE_COOKIE, detectCountry, proposedProfile, resolveProfile } from "./config";
import { translate, type MessageValues } from "./messages";
/**
 * Saved account preferences win once onboarding is done. Before that (signed out, or onboarding still open) the
 * language picked by hand (cookie) wins, otherwise the visitor's country decides (English outside Italy and the
 * German-speaking countries), then the browser's language; onboarding proposes the result.
 */
export const getLocaleProfile = cache(async () => {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (session?.user.onboardingCompleted) return resolveProfile(session.user);
  return proposedProfile({
    chosenLanguage: (await cookies()).get(LANGUAGE_COOKIE)?.value,
    country: detectCountry(requestHeaders),
    acceptLanguage: requestHeaders.get("accept-language"),
  });
});
/** Server translator scoped to the current request. */
export async function getTranslator() {
  const { language } = await getLocaleProfile();
  return <T,>(source: T, values?: MessageValues) => translate(language, source, values);
}
