import type { Metadata } from "next";
import { JsonLd, pageJsonLd } from "@/components/json-ld";
import { LegalPage } from "@/components/legal-page";
import { TERMINI } from "@/content/legal";
import { EN_PATHS, languageAlternates } from "@/content/locales";
import { pageMetadata } from "@/lib/page-metadata";

const META = {
  title: `${TERMINI.title} · BuddyBudget`,
  description: TERMINI.description,
};

export const metadata: Metadata = pageMetadata("it", { ...META, alternates: languageAlternates("/termini", "it") });

export default function Page() {
  return (
    <>
      <JsonLd data={pageJsonLd({ locale: "it", path: "/termini", ...META })} />
      <LegalPage doc={TERMINI} alternate={EN_PATHS.terms} />
    </>
  );
}
