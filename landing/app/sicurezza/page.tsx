import type { Metadata } from "next";
import Link from "next/link";
import "@/components/faq.css";
import "@/components/security-page.css";
import { ContentPage } from "@/components/content-page";
import { DataFlow } from "@/components/data-flow";
import { FactList } from "@/components/fact-list";
import { JsonLd } from "@/components/json-ld";
import { Sources } from "@/components/sources";
import { LEGAL_OWNER, LEGAL_PATHS } from "@/content/legal";
import { CONTENT_DRAFT, CONTENT_PATHS } from "@/content/seo-pages";
import { ENABLE_BANKING_LIVE } from "@/content/bank-provider";
import { ANALYTICS_DATA, CONTROLS, FLOW, LIMITS, PROVIDER_DATA, SECURITY_PAGE, SECURITY_SOURCES, SECURITY_SOURCES_CHECKED, STORED } from "@/content/security";
import { SITE_URL } from "@/content/site";

export const metadata: Metadata = {
  title: SECURITY_PAGE.title,
  description: SECURITY_PAGE.description,
  alternates: { canonical: CONTENT_PATHS.sicurezza },
  robots: CONTENT_DRAFT ? { index: false, follow: true } : undefined,
};

/**
 * Pagina «Sicurezza e privacy»: in vista il percorso dei dati (diagramma interattivo) e cosa si conserva; il resto
 * (fornitore bancario, statistiche, cancellazione, limiti) in domande a tendina, per non sommergere chi legge. Testi in `content/security.ts`.
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

      <section className="sp-sec" aria-labelledby="sp-more">
        <span className="ref">Le altre domande</span>
        <h2 id="sp-more">Le altre domande.</h2>
        <div className="faq-list sp-questions">
          <details className="faq-item">
            <summary>{PROVIDER_DATA.question}</summary>
            <div className="sp-answer">
              <p>{PROVIDER_DATA.lede}</p>
              <FactList rows={PROVIDER_DATA.rows} />
              {ENABLE_BANKING_LIVE ? (
                <p className="sp-note">Dalle <a href={SECURITY_SOURCES.enableBankingTerms.href} rel="noopener" target="_blank">condizioni di Enable Banking</a> e dalla sua <a href={SECURITY_SOURCES.enableBankingPrivacy.href} rel="noopener" target="_blank">informativa privacy</a>. Per i collegamenti di prima valgono le <a href={SECURITY_SOURCES.gocardlessTerms.href} rel="noopener" target="_blank">condizioni UE di GoCardless</a>.</p>
              ) : (
                <p className="sp-note">Riassunto delle <a href={SECURITY_SOURCES.gocardlessTerms.href} rel="noopener" target="_blank">condizioni UE di GoCardless</a> e della sua <a href={SECURITY_SOURCES.gocardlessPrivacy.href} rel="noopener" target="_blank">informativa privacy</a>, dove trovi i contatti per esercitare i tuoi diritti.</p>
              )}
            </div>
          </details>
          <details className="faq-item">
            <summary>{ANALYTICS_DATA.question}</summary>
            <div className="sp-answer">
              <p>{ANALYTICS_DATA.lede}</p>
              <FactList rows={ANALYTICS_DATA.rows} />
              <p className="sp-note">Tutti i dettagli nella <Link href={LEGAL_PATHS.cookie}>pagina sui cookie</Link>.</p>
            </div>
          </details>
          <details className="faq-item">
            <summary>{CONTROLS.question}</summary>
            <div className="sp-answer">
              <FactList rows={CONTROLS.items.map((item) => ({ label: item.title, text: item.text }))} />
            </div>
          </details>
          <details className="faq-item">
            <summary>{LIMITS.question}</summary>
            <div className="sp-answer">
              <FactList rows={LIMITS.items.map((item) => ({ label: item.title, text: item.text }))} />
            </div>
          </details>
        </div>
        <p className="sp-note">Per i dettagli legali (basi giuridiche, fornitori, tempi di conservazione) leggi l&apos;<Link href={LEGAL_PATHS.privacy}>informativa privacy</Link>. Per segnalare un problema di sicurezza scrivi a <a href={`mailto:${LEGAL_OWNER.email}`}>{LEGAL_OWNER.email}</a>.</p>
      </section>

      <Sources items={Object.values(SECURITY_SOURCES)} checked={SECURITY_SOURCES_CHECKED} summary="Fonti ufficiali" />
    </ContentPage>
  );
}
