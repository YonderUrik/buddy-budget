import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { JsonLd } from "@/components/json-ld";
import { RisparmioCalculator } from "@/components/tools/risparmio-calculator";
import { CONTENT_DRAFT, CONTENT_PATHS, TOOLS } from "@/content/seo-pages";
import { SITE_URL } from "@/content/site";

const TITLE = "Calcolatore obiettivo di risparmio: in quanto tempo metti da parte una cifra";
const DESCRIPTION = "Scrivi quanto vuoi mettere da parte e quanto risparmi al mese: vedi in quanto tempo ci arrivi e quanto prima arrivi risparmiando qualcosa in più. Gratis, senza registrazione.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: CONTENT_PATHS.risparmio },
  robots: CONTENT_DRAFT ? { index: false, follow: true } : undefined,
};

export default function Page() {
  return (
    <ContentPage kicker="Calcolatore gratuito, senza account" current={CONTENT_PATHS.strumenti} crumbs={[{ href: "/", label: "BuddyBudget" }, { href: CONTENT_PATHS.strumenti, label: "Calcolatori" }, { label: "Obiettivo di risparmio" }]} ctaTitle="Con i tuoi numeri veri." ctaText="In BuddyBudget quanto risparmi al mese arriva dai movimenti della banca, non da una stima a occhio. Nella sezione Analitiche sposti un cursore e vedi subito cosa cambia." ctaLocation="calcolatore_risparmio">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebPage", name: "Calcolatore obiettivo di risparmio", url: `${SITE_URL}${CONTENT_PATHS.risparmio}`, inLanguage: "it-IT", description: DESCRIPTION, isPartOf: { "@id": `${SITE_URL}/#website` } }} />
      <h1>In quanto tempo metti da parte una cifra?</h1>
      <p className="lead">Scrivi l&apos;obiettivo, quanto hai già e quanto riesci a risparmiare al mese. Poi prova a mettere da parte qualcosa in più e guarda quanto prima ci arrivi.</p>
      <RisparmioCalculator />
      <p className="note">Stima semplificata: il risparmio resta uguale ogni mese, il rendimento è costante e al lordo di tasse e costi, l&apos;inflazione non è considerata.</p>
      <h2>Come funziona il calcolo</h2>
      <ul>
        <li>Ogni mese al saldo si aggiunge quello che metti da parte.</li>
        <li>Se indichi un rendimento, il saldo cresce di quella percentuale all&apos;anno, ripartita mese per mese.</li>
        <li>Il calcolo si ferma il mese in cui il saldo arriva all&apos;obiettivo.</li>
        <li>Con rendimento 0 è una divisione: quello che manca diviso il risparmio mensile.</li>
      </ul>
      <h2>Altri calcolatori</h2>
      <div className="related">
        {TOOLS.filter((t) => t.href !== CONTENT_PATHS.risparmio).map((t) => (
          <Link key={t.href} href={t.href}>{t.title}<span>{t.text}</span></Link>
        ))}
      </div>
    </ContentPage>
  );
}
