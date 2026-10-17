import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { PRIVACY } from "@/content/legal";

export const metadata: Metadata = {
  title: `${PRIVACY.title} · BuddyBudget`,
  description: PRIVACY.description,
  alternates: { canonical: "/privacy" },
};

export default function Page() {
  return <LegalPage doc={PRIVACY} />;
}
