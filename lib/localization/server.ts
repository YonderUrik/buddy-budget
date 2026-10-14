import "server-only";
import { cache } from "react";
import { headers, cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { LANGUAGE_COOKIE, LANGUAGES, resolveProfile, type Language } from "./config";
import { translate, type MessageValues } from "./messages";
/** Resolve authenticated preferences first; the cookie only controls signed-out display language. */
export const getLocaleProfile = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) return resolveProfile(session.user);
  const language = (await cookies()).get(LANGUAGE_COOKIE)?.value;
  return { productCountry: "IT" as const, language: LANGUAGES.includes(language as Language) ? language as Language : "it" as const };
});
/** Server translator scoped to the current request. */
export async function getTranslator() {
  const { language } = await getLocaleProfile();
  return <T,>(source: T, values?: MessageValues) => translate(language, source, values);
}
