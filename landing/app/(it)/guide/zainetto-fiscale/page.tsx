import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { GuideExample } from "@/components/guide-example";
import { JsonLd, pageJsonLd } from "@/components/json-ld";
import { languageAlternates } from "@/content/locales";
import { YearsStrip } from "@/components/viz/viz";
import { Sources } from "@/components/sources";
import { CONTENT_DRAFT, CONTENT_PATHS, SOURCES } from "@/content/seo-pages";
import { pageMetadata } from "@/lib/page-metadata";

const H1 = "Zainetto fiscale: cos'è e come recuperare le minusvalenze";
/** Different from the h1 on purpose: a title identical to the h1 wastes the second chance to describe the page. */
const TITLE = "Zainetto fiscale: guida alle minusvalenze, con esempi";
const DESCRIPTION = "Che cos'è lo zainetto fiscale, come funzionano i 4 anni per compensare le minusvalenze di azioni e ETF, con esempi numerici e un calcolatore gratuito.";

export const metadata: Metadata = pageMetadata("it", {
  title: TITLE,
  description: DESCRIPTION,
  alternates: languageAlternates(CONTENT_PATHS.guidaZainetto, "it"),
  robots: CONTENT_DRAFT ? { index: false, follow: true } : undefined,
});

export default function Page() {
  return (
    <ContentPage title={H1} current={CONTENT_PATHS.guidaZainetto} lead={<>Se vendi un investimento in perdita, quella perdita non è tutta persa: per quattro anni puoi usarla per ridurre le tasse sui guadagni futuri. Questo &ldquo;serbatoio&rdquo; di perdite è lo zainetto fiscale.</>} crumbs={[{ href: "/", label: "BuddyBudget" }, { label: "Guide" }, { label: "Zainetto fiscale" }]} ctaTitle="Lo zainetto lo tiene BuddyBudget." ctaText="BuddyBudget ricostruisce lo zaino fiscale dalle tue operazioni e ti avvisa quando una minusvalenza sta per scadere." ctaLocation="guida_zainetto">
      <JsonLd data={pageJsonLd({ locale: "it", path: CONTENT_PATHS.guidaZainetto, title: TITLE, description: DESCRIPTION, type: "Article", extra: { author: { "@type": "Organization", name: "BuddyBudget" } } })} />
      <h2>Che cos&apos;è</h2>
      <p>Quando vendi azioni, ETF o altri strumenti e incassi più di quanto hai pagato, hai una plusvalenza e paghi di norma il 26%. Se incassi meno, hai una minusvalenza. Le minusvalenze possono compensare le plusvalenze della stessa categoria, riducendo l&apos;imposta. Quelle che non riesci a usare subito restano &ldquo;nello zainetto&rdquo;.</p>
      <h2>Per quanto tempo si porta</h2>
      <YearsStrip from={2023} label="Una minusvalenza del 2023 si può usare fino al 2027" />
      <p>Una minusvalenza si può riportare fino al quarto anno successivo a quello in cui è stata realizzata. Una perdita del 2023 si può usare fino al 2027; dal 2028 è scaduta. Se hai più perdite, di norma si parte dalle più vecchie.</p>
      <h2>Un esempio</h2>
      <GuideExample />
      <p>Compensi prima i 1.500 € del 2023 e poi 1.500 € dei 2.000 € del 2025: la base imponibile è zero, l&apos;imposta evitata è 780 € (il 26% di 3.000) e restano 500 € di minusvalenza utilizzabili fino al 2029. Prova i tuoi numeri con il <Link href={CONTENT_PATHS.zainetto}>calcolatore dello zainetto fiscale</Link>.</p>
      <h2>Cosa entra nello zainetto, strumento per strumento</h2>
      <p>Lo zainetto raccoglie le perdite che il fisco chiama redditi diversi. Non tutti gli strumenti si comportano allo stesso modo, e la differenza più importante riguarda gli ETF.</p>
      <ul>
        <li><b>Azioni, obbligazioni societarie, ETC e certificati</b>: guadagni e perdite sono redditi diversi. Una perdita entra nello zainetto e un guadagno può usarlo.</li>
        <li><b>ETF e fondi</b>: la perdita entra nello zainetto, ma il guadagno è un reddito di capitale e paga il 26% pieno anche se lo zainetto è pieno. Per usare le perdite servono guadagni su azioni, obbligazioni, ETC o certificati.</li>
        <li><b>Titoli di Stato (BTP, BOT e simili)</b>: il guadagno paga il 12,5%. Per compensare, guadagni e perdite contano per il 48,08% del loro importo, così le due aliquote tornano in pari.</li>
        <li><b>Cripto-attività</b>: hanno un conteggio separato, annuale, con l&apos;aliquota delle cripto (33% dal 2026). Le perdite si riportano anche qui per quattro anni.</li>
      </ul>
      <h2>Due casi che sorprendono</h2>
      <h3>Il guadagno su un ETF</h3>
      <p>Hai 2.000 € nello zainetto e vendi un ETF guadagnando 1.000 €: paghi 260 € (il 26% di 1.000) e lo zainetto resta di 2.000 €. Se lo stesso guadagno di 1.000 € arriva da un&apos;azione, l&apos;imposta è zero e nello zainetto restano 1.000 €. Chi ha solo ETF può accumulare perdite che non userà mai.</p>
      <h3>La perdita su un BTP</h3>
      <p>Vendi un BTP perdendo 1.000 €: nello zainetto entrano 480,77 € (il 48,08% di 1.000), non 1.000 €. Al contrario, un guadagno di 1.000 € su un BTP consuma al massimo 480,77 € di zainetto e senza perdite paga 125 €, cioè il 12,5% di 1.000.</p>
      <h2>Regime amministrato o dichiarativo</h2>
      <p>Se il tuo intermediario opera in regime amministrato, di norma tiene lui il conto delle minusvalenze e applica le compensazioni a ogni vendita, in ordine di data: una perdita compensa solo i guadagni che arrivano dopo, non quelli già tassati prima nello stesso anno. In regime dichiarativo, invece, sommi i risultati di tutto l&apos;anno e li riporti nel quadro RT della dichiarazione dei redditi: l&apos;ordine delle vendite non conta, ma tenere traccia delle perdite e della loro scadenza spetta a te.</p>
      <h2>Se cambi banca o broker</h2>
      <p>Ogni intermediario in regime amministrato ha il suo zainetto: una perdita realizzata presso una banca non riduce da sola le imposte su un guadagno fatto presso un&apos;altra. Se chiudi il deposito titoli, l&apos;intermediario ti rilascia una certificazione delle minusvalenze non usate. Con quella le puoi portare su un altro deposito intestato alle stesse persone oppure usarle nella dichiarazione dei redditi, sempre entro i quattro anni. Chiedi la certificazione prima di chiudere: senza, ricostruire le perdite è difficile.</p>
      <h2>A fine anno, prima che scadano</h2>
      <ul>
        <li>Guarda nel rendiconto o nell&apos;estratto del deposito titoli quante minusvalenze hai e in che anno scadono: quelle realizzate quattro anni fa sono all&apos;ultimo anno utile e scadono il 31 dicembre.</li>
        <li>Se hai titoli in guadagno che non sono ETF, vendere prima della scadenza ti permette di usarle. Contano le commissioni e il fatto che, se ricompri, il prezzo di carico riparte da quello nuovo.</li>
        <li>Se usi più intermediari, tieni un elenco unico: è il caso in cui le perdite si perdono più spesso.</li>
      </ul>
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
      <h3>Le perdite passano agli eredi?</h3>
      <p>In generale no: le minusvalenze sono personali e restano a chi le ha realizzate. Per un caso concreto chiedi a un commercialista.</p>
      <Sources items={[SOURCES.tuir68, SOURCES.dlgs461, SOURCES.circolare19e, SOURCES.quadroRt]} />
    </ContentPage>
  );
}
