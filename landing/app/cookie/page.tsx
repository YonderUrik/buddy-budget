import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { LEGAL_DRAFT, COOKIE } from "@/content/legal";

export const metadata: Metadata = {
  title: `${COOKIE.title} · BuddyBudget`,
  description: COOKIE.description,
  alternates: { canonical: "/cookie" },
  // Finché i testi sono una bozza non vanno indicizzati.
  robots: LEGAL_DRAFT ? { index: false, follow: true } : undefined,
};

export default function Page() {
  return <LegalPage doc={COOKIE} />;
}
