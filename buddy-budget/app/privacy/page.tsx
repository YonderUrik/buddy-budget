import { Metadata } from "next";

import { getLegalDocument } from "@/lib/markdown";
import { LegalPageLayout } from "@/components/layouts/legal-page-layout";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy Policy for Buddy Budget. Learn how we collect, use, and protect your personal information and financial data.",
  openGraph: {
    title: "Privacy Policy - Buddy Budget",
    description: "How Buddy Budget protects your privacy and data",
  },
};

export default function PrivacyPage() {
  const document = getLegalDocument("privacy-policy.md");

  return (
    <LegalPageLayout
      content={document.content}
      description="Your privacy is important to us. Learn how we handle your data and protect your information."
      pageTitle={document.frontmatter.title}
    />
  );
}
