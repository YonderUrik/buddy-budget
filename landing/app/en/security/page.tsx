import type { Metadata } from "next";
import { SecurityPage } from "@/components/security-page";
import { SECURITY_EN } from "@/content/en/security";
import { EN_PATHS, languageAlternates } from "@/content/locales";

export const metadata: Metadata = {
  title: SECURITY_EN.page.title,
  description: SECURITY_EN.page.description,
  alternates: languageAlternates(EN_PATHS.security, "en"),
};

/** English security page (`/en/security`); texts in `content/en/security.ts`. */
export default function Page() {
  return <SecurityPage content={SECURITY_EN} path={EN_PATHS.security} home={EN_PATHS.home} />;
}
