import "server-only";
import { cache } from "react";
import { headers, cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { LANGUAGE_COOKIE, LANGUAGES, detectLanguage, profileForLanguage, resolveProfile, type Language } from "./config";
import { translate, type MessageValues } from "./messages";
/**
 * Saved account preferences win once onboarding is done. Before that (signed out, or onboarding still open) the
 * language picked by hand (cookie) wins, otherwise the browser's language is used, and onboarding proposes it.
 */
export const getLocaleProfile = cache(async () => {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (session?.user.onboardingCompleted) return resolveProfile(session.user);
  const chosen = (await cookies()).get(LANGUAGE_COOKIE)?.value;
  const language = LANGUAGES.includes(chosen as Language) ? chosen as Language : detectLanguage(requestHeaders.get("accept-language"));
  return profileForLanguage(language);
});
/** Server translator scoped to the current request. */
export async function getTranslator() {
  const { language } = await getLocaleProfile();
  return <T,>(source: T, values?: MessageValues) => translate(language, source, values);
}
