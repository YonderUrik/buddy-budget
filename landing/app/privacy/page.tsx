import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { LEGAL_DRAFT, PRIVACY } from "@/content/legal";

export const metadata: Metadata = {
  title: `${PRIVACY.title} · BuddyBudget`,
  description: PRIVACY.description,
  alternates: { canonical: "/privacy" },
  // Finché i testi sono una bozza non vanno indicizzati.
  robots: LEGAL_DRAFT ? { index: false, follow: true } : undefined,
};

export default function Page() {
  return <LegalPage doc={PRIVACY} />;
}
