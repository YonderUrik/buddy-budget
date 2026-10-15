import { localizedMetadata } from "@/lib/localization/metadata";
import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { PRIVACY } from "@/content/legal";

export const metadata: Metadata = localizedMetadata({
  title: `${PRIVACY.title} · BuddyBudget`,
  description: PRIVACY.description,
  alternates: { canonical: "/privacy" },
}, "/privacy");

export default function Page() {
  return <LegalPage doc={PRIVACY} />;
}
