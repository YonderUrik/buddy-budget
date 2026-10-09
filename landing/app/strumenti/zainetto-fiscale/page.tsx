import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { JsonLd } from "@/components/json-ld";
import { ZainettoCalculator } from "@/components/tools/zainetto-calculator";
import { Sources } from "@/components/sources";
import { CONTENT_DRAFT, CONTENT_PATHS, SOURCES } from "@/content/seo-pages";
import { SITE_URL } from "@/content/site";

const TITLE = "Calcolatore zainetto fiscale: minusvalenze e imposta sulle plusvalenze";
const DESCRIPTION = "Calcola quanto puoi compensare con le minusvalenze degli ultimi 4 anni e quanta imposta paghi su una plusvalenza di azioni, ETF o titoli di Stato. Gratis, senza registrazione.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: CONTENT_PATHS.zainetto },
  robots: CONTENT_DRAFT ? { index: false, follow: true } : undefined,
};

export default function Page() {
  return (
    <ContentPage kicker="Calcolatore gratuito, senza account" current={CONTENT_PATHS.zainetto} crumbs={[{ href: "/", label: "BuddyBudget" }, { label: "Calcolatori" }, { label: "Zainetto fiscale" }]} ctaTitle="Lo zainetto si aggiorna da solo." ctaText="In BuddyBudget minusvalenze, scadenze a 4 anni, bollo e imposta di una vendita ipotetica si calcolano dalle tue operazioni. Non c'è un foglio da rifare ogni anno." ctaLocation="calcolatore_zainetto">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebApplication", name: "Calcolatore zainetto fiscale", url: `${SITE_URL}${CONTENT_PATHS.zainetto}`, applicationCategory: "FinanceApplication", operatingSystem: "Web", inLanguage: "it-IT", description: DESCRIPTION, offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" } }} />
      <h1>Calcolatore dello zainetto fiscale</h1>
      <p className="lead">Inserisci la plusvalenza dell&apos;anno e le minusvalenze che ti porti dietro: vedi quali puoi ancora usare, quante ne compensi e quanta imposta paghi.</p>
      <ZainettoCalculator />
      <p className="note">Stima semplificata: una sola categoria di reddito, nessun arrotondamento di legge, regole dei titoli di Stato non ponderate. Non sostituisce il rendiconto del tuo intermediario né un consulente.</p>
      <h2>Come funziona il calcolo</h2>
      <ul>
        <li>Le minusvalenze si compensano con le plusvalenze della stessa categoria di redditi diversi.</li>
        <li>Una minusvalenza si può riportare fino al quarto anno successivo a quello in cui è stata realizzata: una perdita del 2023 si usa fino al 2027.</li>
        <li>Di norma si parte dalle più vecchie, perché sono quelle che scadono prima: il calcolatore segue questo criterio.</li>
        <li>Sull&apos;eccedenza si paga il 26% (12,5% per i titoli di Stato).</li>
      </ul>
      <p>Vuoi capire la logica con degli esempi? Leggi la <Link href={CONTENT_PATHS.guidaZainetto}>guida allo zainetto fiscale</Link>.</p>
      <h2>Altri strumenti</h2>
      <div className="related">
        <Link href={CONTENT_PATHS.ammortamento}>Piano di ammortamento<span>Rata, interessi ed estinzione anticipata di un finanziamento.</span></Link>
        <Link href={CONTENT_PATHS.funzioneInvestimenti}>Investimenti con le tasse italiane<span>Come BuddyBudget calcola rendimento, zaino fiscale e bollo.</span></Link>
      </div>
      <Sources items={[SOURCES.tuir68, SOURCES.circolare19e, SOURCES.quadroRt]} />
    </ContentPage>
  );
}
