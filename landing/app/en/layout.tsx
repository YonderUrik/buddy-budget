import type { Metadata } from "next";
import { RootDocument, ROOT_VIEWPORT, rootMetadata } from "@/components/root-document";
import { OG_ALT_EN, SITE_DESCRIPTION_EN, SITE_TITLE_EN } from "@/content/en/home";
import { EN_PATHS } from "@/content/locales";

export const metadata: Metadata = {
  ...rootMetadata("en", { title: SITE_TITLE_EN, description: SITE_DESCRIPTION_EN, ogAlt: OG_ALT_EN }),
  alternates: { canonical: EN_PATHS.home },
};

export const viewport = ROOT_VIEWPORT;

/**
 * Root layout of the English site (`/en/…`): `<html lang="en" data-screens="en">`. Moving between the two languages
 * is a full page load, because each has its own root layout.
 */
export default function EnglishLayout({ children }: { children: React.ReactNode }) {
  return <RootDocument locale="en">{children}</RootDocument>;
}
