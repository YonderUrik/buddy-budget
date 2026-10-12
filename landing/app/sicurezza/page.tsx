import type { Metadata } from "next";
import Link from "next/link";
import "@/components/security-page.css";
import { ContentPage } from "@/components/content-page";
import { DataFlow } from "@/components/data-flow";
import { FactTable } from "@/components/fact-table";
import { JsonLd } from "@/components/json-ld";
import { Sources } from "@/components/sources";
import { LEGAL_OWNER, LEGAL_PATHS } from "@/content/legal";
import { CONTENT_DRAFT, CONTENT_PATHS } from "@/content/seo-pages";
import { ANALYTICS_DATA, CONTROLS, FLOW, GOCARDLESS_DATA, LIMITS, SECURITY_PAGE, SECURITY_SOURCES, SECURITY_SOURCES_CHECKED, STORED } from "@/content/security";
import { SITE_URL, SOURCE_URL } from "@/content/site";

export const metadata: Metadata = {
  title: SECURITY_PAGE.title,
  description: SECURITY_PAGE.description,
  alternates: { canonical: CONTENT_PATHS.sicurezza },
  robots: CONTENT_DRAFT ? { index: false, follow: true } : undefined,
};

/** Il punto sul codice aperto si mostra solo quando il repository è pubblico (`SOURCE_URL` impostato). */
const limits = LIMITS.items.filter((item) => SOURCE_URL || !item.title.startsWith("Il codice"));

/**
 * Pagina «Sicurezza e privacy»: il percorso dei dati quando si collega la banca (diagramma interattivo), cosa si
 * conserva, come si cancella tutto, i limiti detti apertamente e le fonti ufficiali. Ogni frase sta in `content/security.ts`.
 */
export default function Page() {
  return (
    <ContentPage kicker="Sicurezza e privacy" current={CONTENT_PATHS.sicurezza} disclaimer={false} wide crumbs={[{ href: "/", label: "BuddyBudget" }, { label: "Sicurezza e privacy" }]} ctaTitle="Prova senza collegare niente." ctaText="Puoi iniziare con un conto manuale o con i dati d'esempio, e collegare la banca solo quando ti senti pronto." ctaLocation="sicurezza">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebPage", name: SECURITY_PAGE.h1, description: SECURITY_PAGE.description, inLanguage: "it-IT", url: `${SITE_URL}${CONTENT_PATHS.sicurezza}` }} />
      <h1>{SECURITY_PAGE.h1}</h1>
      <p className="lead">{SECURITY_PAGE.lead}</p>

      <section className="sp-sec" aria-labelledby="sp-flow">
        <span className="ref">{FLOW.kicker}</span>
        <h2 id="sp-flow">{FLOW.title}</h2>
        <p>{FLOW.lede}</p>
        <DataFlow />
      </section>

      <section className="sp-sec" aria-labelledby="sp-stored">
        <span className="ref">{STORED.kicker}</span>
        <h2 id="sp-stored">{STORED.title}</h2>
        <div className="sp-table cell">
          <table>
            <thead>
              <tr>
                <th scope="col">Dato</th>
                <th scope="col">Lo conserviamo?</th>
                <th scope="col">Dettagli</th>
              </tr>
            </thead>
            <tbody>
              {STORED.rows.map((row) => (
                <tr key={row.what}>
                  <th scope="row">{row.what}</th>
                  <td><span className={`sp-kept sp-kept-${row.kept}`}>{row.keptLabel}</span></td>
                  <td>{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="sp-sec" aria-labelledby="sp-gocardless">
        <span className="ref">{GOCARDLESS_DATA.kicker}</span>
        <h2 id="sp-gocardless">{GOCARDLESS_DATA.title}</h2>
        <p>{GOCARDLESS_DATA.lede}</p>
        <FactTable rows={GOCARDLESS_DATA.rows} caption={GOCARDLESS_DATA.title} />
        <p className="sp-note">Le frasi riassumono le <a href={SECURITY_SOURCES.gocardlessTerms.href} rel="noopener" target="_blank">condizioni UE di GoCardless</a> e la sua <a href={SECURITY_SOURCES.gocardlessPrivacy.href} rel="noopener" target="_blank">informativa privacy</a>, dove trovi anche i contatti per esercitare i tuoi diritti.</p>
      </section>

      <section className="sp-sec" aria-labelledby="sp-analytics">
        <span className="ref">{ANALYTICS_DATA.kicker}</span>
        <h2 id="sp-analytics">{ANALYTICS_DATA.title}</h2>
        <p>{ANALYTICS_DATA.lede}</p>
        <FactTable rows={ANALYTICS_DATA.rows} caption={ANALYTICS_DATA.title} />
        <p className="sp-note">Tutti i dettagli, compreso come spegnerle sul sito, nella <Link href={LEGAL_PATHS.cookie}>pagina sui cookie</Link>.</p>
      </section>

      <section className="sp-sec" aria-labelledby="sp-controls">
        <span className="ref">{CONTROLS.kicker}</span>
        <h2 id="sp-controls">{CONTROLS.title}</h2>
        <div className="sp-grid">
          {CONTROLS.items.map((item) => (
            <article key={item.title} className="cell sp-card">
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="sp-sec" aria-labelledby="sp-limits">
        <span className="ref">{LIMITS.kicker}</span>
        <h2 id="sp-limits">{LIMITS.title}</h2>
        <div className="sp-grid sp-grid-3">
          {limits.map((item) => (
            <article key={item.title} className="cell sp-card">
              <h3>{item.title}</h3>
              <p>{item.text}{item.title.startsWith("Il codice") && SOURCE_URL ? <> <a href={SOURCE_URL} rel="noopener">Apri il codice</a>.</> : null}</p>
            </article>
          ))}
        </div>
        <p className="sp-note">Per tutti i dettagli legali (basi giuridiche, fornitori, trasferimenti, tempi di conservazione) leggi l&apos;<Link href={LEGAL_PATHS.privacy}>informativa privacy</Link>. Per segnalare un problema di sicurezza scrivi a <a href={`mailto:${LEGAL_OWNER.email}`}>{LEGAL_OWNER.email}</a>.</p>
      </section>

      <Sources items={Object.values(SECURITY_SOURCES)} checked={SECURITY_SOURCES_CHECKED} summary="Fonti ufficiali" />
    </ContentPage>
  );
}
