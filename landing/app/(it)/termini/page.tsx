import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { TERMINI } from "@/content/legal";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("it", {
  title: `${TERMINI.title} · BuddyBudget`,
  description: TERMINI.description,
  alternates: { canonical: "/termini" },
});

export default function Page() {
  return <LegalPage doc={TERMINI} />;
}
