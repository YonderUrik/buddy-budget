import { localizedMetadata } from "@/lib/localization/metadata";
import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { TERMINI } from "@/content/legal";

export const metadata: Metadata = localizedMetadata({
  title: `${TERMINI.title} · BuddyBudget`,
  description: TERMINI.description,
  alternates: { canonical: "/termini" },
}, "/termini");

export default function Page() {
  return <LegalPage doc={TERMINI} />;
}
