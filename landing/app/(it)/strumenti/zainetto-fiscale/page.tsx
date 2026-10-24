import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { JsonLd, pageJsonLd } from "@/components/json-ld";
import { languageAlternates } from "@/content/locales";
import { ZainettoCalculator } from "@/components/tools/zainetto-calculator";
import { Sources } from "@/components/sources";
import { CONTENT_DRAFT, CONTENT_PATHS, SOURCES } from "@/content/seo-pages";
import { pageMetadata } from "@/lib/page-metadata";

const TITLE = "Calcolatore zainetto fiscale: minusvalenze e imposta";
const DESCRIPTION = "Calcola quanto compensi con le minusvalenze degli ultimi 4 anni e l'imposta su una plusvalenza di azioni, ETF o titoli di Stato. Gratis, senza account.";

export const metadata: Metadata = pageMetadata("it", {
  title: TITLE,
  description: DESCRIPTION,
  alternates: languageAlternates(CONTENT_PATHS.zainetto, "it"),
  robots: CONTENT_DRAFT ? { index: false, follow: true } : undefined,
});

export default function Page() {
  return (
    <ContentPage title="Calcolatore dello zainetto fiscale" lead={<>Inserisci la plusvalenza dell&apos;anno e le minusvalenze che ti porti dietro: vedi quali puoi ancora usare, quante ne compensi e quanta imposta paghi.</>} current={CONTENT_PATHS.zainetto} crumbs={[{ href: "/", label: "BuddyBudget" }, { href: CONTENT_PATHS.strumenti, label: "Calcolatori" }, { label: "Zainetto fiscale" }]} ctaTitle="Lo zainetto si aggiorna da solo." ctaText="In BuddyBudget minusvalenze, scadenze a 4 anni, bollo e imposta di una vendita ipotetica si calcolano dalle tue operazioni. Non c'è un foglio da rifare ogni anno." ctaLocation="calcolatore_zainetto">
      <JsonLd data={pageJsonLd({ locale: "it", path: CONTENT_PATHS.zainetto, title: TITLE, description: DESCRIPTION })} />
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
