import type { Metadata } from "next";
import { RootDocument, ROOT_VIEWPORT, rootMetadata } from "@/components/root-document";
import { OG_IMAGE, SITE_DESCRIPTION, SITE_TITLE } from "@/content/site";

export const metadata: Metadata = {
  ...rootMetadata("it", { title: SITE_TITLE, description: SITE_DESCRIPTION, ogAlt: OG_IMAGE.alt }),
  alternates: { canonical: "/" },
};

export const viewport = ROOT_VIEWPORT;

/** Root layout of the Italian site (every page outside `/en`): `<html lang="it">`. */
export default function ItalianLayout({ children }: { children: React.ReactNode }) {
  return <RootDocument locale="it">{children}</RootDocument>;
}
