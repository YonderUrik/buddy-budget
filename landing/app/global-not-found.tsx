import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { RootDocument, rootMetadata } from "@/components/root-document";
import { OG_IMAGE, SITE_DESCRIPTION } from "@/content/site";
import { CONTENT_PATHS } from "@/content/seo-pages";

export const metadata: Metadata = {
  ...rootMetadata("it", { title: "Pagina non trovata · BuddyBudget", description: SITE_DESCRIPTION, ogAlt: OG_IMAGE.alt }),
  robots: { index: false, follow: true },
};

/**
 * 404 for every unmatched address. With two root layouts (Italian and English) there is no single layout to wrap a
 * `not-found.tsx`, so this file renders its own `<html>` (Next's `global-not-found`, enabled in `next.config.ts`).
 * In Italian, like the root of the site; the bar's «IT / EN» switch leads to the English home.
 */
export default function GlobalNotFound() {
  return (
    <RootDocument locale="it">
      <ContentPage title="Questa pagina non esiste" lead={<>L&apos;indirizzo potrebbe essere sbagliato o la pagina è stata spostata. Da qui puoi andare in questi posti.</>} crumbs={[{ href: "/", label: "BuddyBudget" }, { label: "Pagina non trovata" }]} ctaTitle="Crea un account per iniziare." ctaText="Accedi con un link via email o con Google. Nessuna password da ricordare." ctaLocation="funzioni" disclaimer={false}>
        <div className="related">
          <Link href="/">Home<span>Tutti i tuoi soldi, in un numero solo.</span></Link>
          <Link href={CONTENT_PATHS.funzioni}>Funzioni<span>L&apos;elenco completo, area per area.</span></Link>
          <Link href={CONTENT_PATHS.strumenti}>Calcolatori<span>Zainetto fiscale, ammortamento, obiettivo di risparmio: senza account.</span></Link>
          <Link href={CONTENT_PATHS.sicurezza}>Sicurezza<span>Cosa salviamo, dove sono i server e come cancelli tutto.</span></Link>
          <Link href="/en">In English<span lang="en">The English version of the site.</span></Link>
        </div>
      </ContentPage>
    </RootDocument>
  );
}
