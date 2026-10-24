import type { Metadata } from "next";
import { JsonLd, pageJsonLd } from "@/components/json-ld";
import { LegalPage } from "@/components/legal-page";
import { PRIVACY } from "@/content/legal";
import { EN_PATHS, languageAlternates } from "@/content/locales";
import { pageMetadata } from "@/lib/page-metadata";

const META = {
  title: `${PRIVACY.title} · BuddyBudget`,
  description: PRIVACY.description,
};

export const metadata: Metadata = pageMetadata("it", { ...META, alternates: languageAlternates("/privacy", "it") });

export default function Page() {
  return (
    <>
      <JsonLd data={pageJsonLd({ locale: "it", path: "/privacy", ...META })} />
      <LegalPage doc={PRIVACY} alternate={EN_PATHS.privacy} />
    </>
  );
}
