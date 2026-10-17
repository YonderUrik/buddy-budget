import type { Metadata } from "next";
import { SecurityPage } from "@/components/security-page";
import { languageAlternates } from "@/content/locales";
import { CONTENT_DRAFT, CONTENT_PATHS } from "@/content/seo-pages";
import { SECURITY_IT } from "@/content/security";

export const metadata: Metadata = {
  title: SECURITY_IT.page.title,
  description: SECURITY_IT.page.description,
  alternates: languageAlternates(CONTENT_PATHS.sicurezza, "it"),
  robots: CONTENT_DRAFT ? { index: false, follow: true } : undefined,
};

/** «Sicurezza e privacy» page; texts in `content/security.ts`, layout in `SecurityPage`. */
export default function Page() {
  return <SecurityPage content={SECURITY_IT} path={CONTENT_PATHS.sicurezza} home="/" />;
}
