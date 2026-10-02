import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { LEGAL_DRAFT, TERMINI } from "@/content/legal";

export const metadata: Metadata = {
  title: `${TERMINI.title} · BuddyBudget`,
  description: TERMINI.description,
  alternates: { canonical: "/termini" },
  // Finché i testi sono una bozza non vanno indicizzati.
  robots: LEGAL_DRAFT ? { index: false, follow: true } : undefined,
};

export default function Page() {
  return <LegalPage doc={TERMINI} />;
}
