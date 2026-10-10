import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { TERMINI } from "@/content/legal";

export const metadata: Metadata = {
  title: `${TERMINI.title} · BuddyBudget`,
  description: TERMINI.description,
  alternates: { canonical: "/termini" },
};

export default function Page() {
  return <LegalPage doc={TERMINI} />;
}
