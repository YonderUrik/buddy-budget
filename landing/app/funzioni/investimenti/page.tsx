import type { Metadata } from "next";
import Link from "next/link";
import { AppShot } from "@/components/app-shot";
import { ContentPage } from "@/components/content-page";
import { JsonLd } from "@/components/json-ld";
import { Sources } from "@/components/sources";
import { CONTENT_DRAFT, CONTENT_PATHS, SOURCES } from "@/content/seo-pages";
import { SITE_URL } from "@/content/site";

const TITLE = "Tracciare gli investimenti con le tasse italiane: ETF, azioni, BTP";
const DESCRIPTION = "Rendimento vero, confronto con un indice, rischio, diversificazione, zaino fiscale, bollo e imposta di una vendita ipotetica: gli investimenti di BuddyBudget, pensati per le regole italiane.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: CONTENT_PATHS.funzioneInvestimenti },
  robots: CONTENT_DRAFT ? { index: false, follow: true } : undefined,
};

const BLOCKS = [
  { icon: "M3 17l6-6 4 4 8-8M15 7h6v6", tone: "acc", title: "Rendimento vero", text: "Il rendimento pesato per i tempi dei tuoi versamenti, confrontato con un indice a parità di flussi." },
  { icon: "M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4", tone: "pos", title: "Rischio e diversificazione", text: "Quanto oscilla il portafoglio e come è distribuito tra strumenti, aree e settori." },
  { icon: "M19 5L5 19M7.5 8a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM16.5 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3z", tone: "sun", title: "Fiscalità italiana", text: "Plusvalenze, zaino fiscale a 4 anni e bollo calcolati dalle tue operazioni." },
  { icon: "M5 12l5 5L20 7", tone: "neg", title: "Prima di vendere", text: "L'imposta che pagheresti vendendo oggi, anche con le minusvalenze già nello zainetto." },
] as const;

export default function Page() {
  return (
    <ContentPage crumbs={[{ href: "/", label: "BuddyBudget" }, { label: "Funzioni" }, { label: "Investimenti" }]} ctaTitle="Prova gli investimenti con i tuoi dati." ctaText="Collega la banca, aggiungi le operazioni o importa un CSV, e vedi il quadro completo con le tasse già dentro." ctaLocation="funzione_investimenti">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebPage", name: TITLE, description: DESCRIPTION, url: `${SITE_URL}${CONTENT_PATHS.funzioneInvestimenti}`, inLanguage: "it-IT" }} />
      <h1>Investimenti, con le tasse italiane</h1>
      <p className="lead">ETF, azioni, BTP, fondi e crypto in un solo posto, accanto ai tuoi conti e ai tuoi debiti. Il rendimento è calcolato dalle tue operazioni e le tasse seguono le regole italiane.</p>
      <AppShot id="investimenti" className="cp-shot" priority />
      <div className="fn-grid">
        {BLOCKS.map((b) => (
          <div key={b.title} className={`fn-card tone-${b.tone}`}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={b.icon} /></svg><h3>{b.title}</h3><p>{b.text}</p></div>
        ))}
      </div>
      <h2>Strumenti gratuiti</h2>
      <div className="related">
        <Link href={CONTENT_PATHS.zainetto}>Calcolatore zainetto fiscale<span>Minusvalenze, scadenze e imposta su una plusvalenza.</span></Link>
        <Link href={CONTENT_PATHS.guidaZainetto}>Guida allo zainetto fiscale<span>Cos&apos;è, come funzionano i 4 anni, con esempi.</span></Link>
      </div>
      <Sources items={[SOURCES.tuir68, SOURCES.circolare19e]} />
    </ContentPage>
  );
}
