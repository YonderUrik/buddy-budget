import { Metadata } from "next";

import { getLegalDocument } from "@/lib/markdown";
import { LegalPageLayout } from "@/components/layouts/legal-page-layout";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms of Service for Buddy Budget. Read about the terms and conditions for using our personal finance tracking platform.",
  openGraph: {
    title: "Terms of Service - Buddy Budget",
    description: "Terms and conditions for using Buddy Budget",
  },
};

export default function TermsPage() {
  const document = getLegalDocument("terms-of-service.md");

  return (
    <LegalPageLayout
      content={document.content}
      description="Please read these terms carefully before using Buddy Budget. By using our service, you agree to these terms."
      effectiveDate={document.frontmatter.effectiveDate}
      lastUpdated={document.frontmatter.lastUpdated}
      pageTitle={document.frontmatter.title}
    />
  );
}
