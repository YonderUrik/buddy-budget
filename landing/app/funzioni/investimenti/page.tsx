import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { JsonLd } from "@/components/json-ld";
import { CONTENT_DRAFT, CONTENT_PATHS } from "@/content/seo-pages";
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
  { title: "Rendimento vero", text: "Il rendimento pesato per i tempi dei tuoi versamenti, confrontato con un indice a parità di flussi." },
  { title: "Rischio e diversificazione", text: "Quanto oscilla il portafoglio e come è distribuito tra strumenti, aree e settori." },
  { title: "Fiscalità italiana", text: "Plusvalenze, zaino fiscale a 4 anni e bollo calcolati dalle tue operazioni." },
  { title: "Prima di vendere", text: "L'imposta che pagheresti vendendo oggi, anche con le minusvalenze già nello zainetto." },
] as const;

export default function Page() {
  return (
    <ContentPage crumbs={[{ href: "/", label: "BuddyBudget" }, { label: "Funzioni" }, { label: "Investimenti" }]} ctaTitle="Prova gli investimenti con i tuoi dati." ctaText="Collega la banca, aggiungi le operazioni o importa un CSV, e vedi il quadro completo con le tasse già dentro." ctaLocation="funzione_investimenti">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebPage", name: TITLE, description: DESCRIPTION, url: `${SITE_URL}${CONTENT_PATHS.funzioneInvestimenti}`, inLanguage: "it-IT" }} />
      <h1>Gli investimenti, con le tasse italiane già dentro</h1>
      <p className="lead">ETF, azioni, BTP, fondi e crypto in un solo posto, accanto ai tuoi conti e ai tuoi debiti. Il rendimento è quello vero e le tasse sono quelle italiane.</p>
      {/* eslint-disable-next-line @next/next/no-img-element -- sito statico, immagini non ottimizzate */}
      <img className="shot" src="/screens/dark/investimenti.jpg" alt="Investimenti: valore del portafoglio, rendimento e posizioni nell'app BuddyBudget" width={1920} height={1200} loading="eager" />
      <div className="fn-grid">
        {BLOCKS.map((b) => (
          <div key={b.title} className="tool-card"><h3>{b.title}</h3><p>{b.text}</p></div>
        ))}
      </div>
      <h2>Strumenti gratuiti</h2>
      <div className="related">
        <Link href={CONTENT_PATHS.zainetto}>Calcolatore zainetto fiscale<span>Minusvalenze, scadenze e imposta su una plusvalenza.</span></Link>
        <Link href={CONTENT_PATHS.guidaZainetto}>Guida allo zainetto fiscale<span>Cos&apos;è, come funzionano i 4 anni, con esempi.</span></Link>
      </div>
    </ContentPage>
  );
}
