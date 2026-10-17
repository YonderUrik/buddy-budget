import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { COOKIE } from "@/content/legal";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("it", {
  title: `${COOKIE.title} · BuddyBudget`,
  description: COOKIE.description,
  alternates: { canonical: "/cookie" },
});

export default function Page() {
  return <LegalPage doc={COOKIE} />;
}
