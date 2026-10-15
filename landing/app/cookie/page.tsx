import { localizedMetadata } from "@/lib/localization/metadata";
import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { COOKIE } from "@/content/legal";

export const metadata: Metadata = localizedMetadata({
  title: `${COOKIE.title} · BuddyBudget`,
  description: COOKIE.description,
  alternates: { canonical: "/cookie" },
}, "/cookie");

export default function Page() {
  return <LegalPage doc={COOKIE} />;
}
