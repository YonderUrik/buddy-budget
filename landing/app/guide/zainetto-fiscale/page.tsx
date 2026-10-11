import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { GuideExample } from "@/components/guide-example";
import { JsonLd } from "@/components/json-ld";
import { YearsStrip } from "@/components/viz/viz";
import { Sources } from "@/components/sources";
import { CONTENT_DRAFT, CONTENT_PATHS, SOURCES } from "@/content/seo-pages";
import { SITE_URL } from "@/content/site";

const H1 = "Zainetto fiscale: cos'è e come recuperare le minusvalenze";
/** Diverso dall'h1 di proposito: un title identico all'h1 spreca la seconda occasione di descrivere la pagina. */
const TITLE = "Zainetto fiscale: guida alle minusvalenze, con esempi";
const DESCRIPTION = "Che cos'è lo zainetto fiscale, come funzionano i 4 anni per compensare le minusvalenze di azioni e ETF, con esempi numerici e un calcolatore gratuito.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: CONTENT_PATHS.guidaZainetto },
  robots: CONTENT_DRAFT ? { index: false, follow: true } : undefined,
};

export default function Page() {
  return (
    <ContentPage kicker="Guida" crumbs={[{ href: "/", label: "BuddyBudget" }, { label: "Guide" }, { label: "Zainetto fiscale" }]} ctaTitle="Lo zainetto lo tiene BuddyBudget." ctaText="BuddyBudget ricostruisce lo zaino fiscale dalle tue operazioni e ti avvisa quando una minusvalenza sta per scadere." ctaLocation="guida_zainetto">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "Article", headline: H1, description: DESCRIPTION, inLanguage: "it-IT", mainEntityOfPage: `${SITE_URL}${CONTENT_PATHS.guidaZainetto}`, author: { "@type": "Organization", name: "BuddyBudget" }, publisher: { "@type": "Organization", name: "BuddyBudget" } }} />
      <h1>{H1}</h1>
      <p className="lead">Se vendi un investimento in perdita, quella perdita non è tutta persa: per quattro anni puoi usarla per ridurre le tasse sui guadagni futuri. Questo &ldquo;serbatoio&rdquo; di perdite è lo zainetto fiscale.</p>
      <h2>Che cos&apos;è</h2>
      <p>Quando vendi azioni, ETF o altri strumenti e incassi più di quanto hai pagato, hai una plusvalenza e paghi di norma il 26%. Se incassi meno, hai una minusvalenza. Le minusvalenze possono compensare le plusvalenze della stessa categoria, riducendo l&apos;imposta. Quelle che non riesci a usare subito restano &ldquo;nello zainetto&rdquo;.</p>
      <h2>Per quanto tempo si porta</h2>
      <YearsStrip from={2023} label="Una minusvalenza del 2023 si può usare fino al 2027" />
      <p>Una minusvalenza si può riportare fino al quarto anno successivo a quello in cui è stata realizzata. Una perdita del 2023 si può usare fino al 2027; dal 2028 è scaduta. Se hai più perdite, di norma si parte dalle più vecchie.</p>
      <h2>Un esempio</h2>
      <GuideExample />
      <p>Compensi prima i 1.500 € del 2023 e poi 1.500 € dei 2.000 € del 2025: la base imponibile è zero, l&apos;imposta evitata è 780 € (il 26% di 3.000) e restano 500 € di minusvalenza utilizzabili fino al 2029. Prova i tuoi numeri con il <Link href={CONTENT_PATHS.zainetto}>calcolatore dello zainetto fiscale</Link>.</p>
      <h2>Regime amministrato o dichiarativo</h2>
      <p>Se il tuo intermediario opera in regime amministrato, di norma tiene lui il conto delle minusvalenze e applica le compensazioni. Se lavori in regime dichiarativo, o hai più intermediari, devi riportare le minusvalenze nella dichiarazione dei redditi: tenerne traccia diventa fondamentale per non perderle.</p>
      <h2>Errori comuni</h2>
      <div className="tips">
        <div><b>1</b><p>Lasciar scadere una minusvalenza senza usarla.</p></div>
        <div><b>2</b><p>Dimenticare le perdite realizzate presso un altro intermediario.</p></div>
        <div><b>3</b><p>Confondere le regole degli strumenti diversi: titoli di Stato, fondi e crypto hanno trattamenti propri.</p></div>
      </div>
      <h2>Domande rapide</h2>
      <h3>Le minusvalenze compensano anche i dividendi?</h3>
      <p>In generale no: i redditi di capitale e i redditi diversi sono categorie distinte. Verifica il tuo caso.</p>
      <h3>Posso usare lo zainetto se non vendo più nulla?</h3>
      <p>Serve una plusvalenza futura da compensare, entro la scadenza dei quattro anni.</p>
      <Sources items={[SOURCES.tuir68, SOURCES.circolare19e, SOURCES.quadroRt]} />
    </ContentPage>
  );
}
