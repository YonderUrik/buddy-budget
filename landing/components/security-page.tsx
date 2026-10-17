import "./faq.css";
import "./security-page.css";
import { counterpart } from "@/content/locales";
import type { SecurityContent } from "@/content/security";
import { SITE_URL } from "@/content/site";
import { otherLocale, SCHEMA_LANGUAGE } from "@/lib/i18n";
import { ContentPage } from "./content-page";
import { DataFlow } from "./data-flow";
import { FactList } from "./fact-list";
import { JsonLd } from "./json-ld";
import { RichText } from "./rich-text";
import { Sources } from "./sources";

/**
 * «Sicurezza e privacy» page in one language (`/sicurezza`, `/en/security`): in view the data path (interactive
 * diagram) and what is stored; the rest (GoCardless, statistics, deletion, limits) in folding questions, so the
 * reader is not swamped. `path` is the page's own path; all texts come from `content`.
 */
export function SecurityPage({ content, path, home }: { content: SecurityContent; path: string; home: string }) {
  const { page, locale } = content;
  return (
    <ContentPage title={page.h1} lead={page.lead} current={path} locale={locale} alternate={counterpart(path, otherLocale(locale))} disclaimer={false} wide crumbs={[{ href: home, label: "BuddyBudget" }, { label: page.crumb }]} ctaTitle={page.ctaTitle} ctaText={page.ctaText} ctaLocation="sicurezza">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebPage", name: page.h1, description: page.description, inLanguage: SCHEMA_LANGUAGE[locale], url: `${SITE_URL}${path}` }} />

      <section className="sp-sec" aria-labelledby="sp-flow">
        <h2 id="sp-flow">{content.flow.title}</h2>
        <p>{content.flow.lede}</p>
        <DataFlow content={content.flow} />
      </section>

      <section className="sp-sec" aria-labelledby="sp-stored">
        <h2 id="sp-stored">{content.stored.title}</h2>
        <div className="sp-table">
          <table>
            <thead>
              <tr>
                <th scope="col">{content.stored.headers.what}</th>
                <th scope="col">{content.stored.headers.kept}</th>
                <th scope="col">{content.stored.headers.detail}</th>
              </tr>
            </thead>
            <tbody>
              {content.stored.rows.map((row) => (
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
        <h2 id="sp-more">{page.more}</h2>
        <div className="faq-list sp-questions">
          <details className="faq-item">
            <summary>{content.gocardless.question}</summary>
            <div className="sp-answer">
              <p>{content.gocardless.lede}</p>
              <FactList rows={content.gocardless.rows} />
              <p className="sp-note"><RichText parts={content.gocardless.note} /></p>
            </div>
          </details>
          <details className="faq-item">
            <summary>{content.analytics.question}</summary>
            <div className="sp-answer">
              <p>{content.analytics.lede}</p>
              <FactList rows={content.analytics.rows} />
              <p className="sp-note"><RichText parts={content.analytics.note} /></p>
            </div>
          </details>
          <details className="faq-item">
            <summary>{content.controls.question}</summary>
            <div className="sp-answer">
              <FactList rows={content.controls.items.map((item) => ({ label: item.title, text: item.text }))} />
            </div>
          </details>
          <details className="faq-item">
            <summary>{content.limits.question}</summary>
            <div className="sp-answer">
              <FactList rows={content.limits.items.map((item) => ({ label: item.title, text: item.text }))} />
            </div>
          </details>
        </div>
        <p className="sp-note"><RichText parts={page.legalNote} /></p>
      </section>

      <Sources items={Object.values(content.sources)} checked={content.sourcesChecked} summary={page.sourcesSummary} locale={locale} />
    </ContentPage>
  );
}
