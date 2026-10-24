import type { Metadata } from "next";
import { JsonLd, pageJsonLd } from "@/components/json-ld";
import { LegalPage } from "@/components/legal-page";
import { COOKIE } from "@/content/legal";
import { EN_PATHS, languageAlternates } from "@/content/locales";
import { pageMetadata } from "@/lib/page-metadata";

const META = {
  title: `${COOKIE.title} · BuddyBudget`,
  // Longer than the lead on the page: search results show 110-160 characters.
  description: "Quali cookie e strumenti simili usano il sito e l'app di BuddyBudget, a cosa servono e perché non serve un banner: solo strumenti tecnici e statistiche anonime.",
};

export const metadata: Metadata = pageMetadata("it", { ...META, alternates: languageAlternates("/cookie", "it") });

export default function Page() {
  return (
    <>
      <JsonLd data={pageJsonLd({ locale: "it", path: "/cookie", ...META })} />
      <LegalPage doc={COOKIE} alternate={EN_PATHS.cookies} />
    </>
  );
}
