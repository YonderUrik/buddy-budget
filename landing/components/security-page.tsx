import "./faq.css";
import "./security-page.css";
import { ArrowDown } from "lucide-react";
import { counterpart } from "@/content/locales";
import type { SecurityContent } from "@/content/security";
import { otherLocale } from "@/lib/i18n";
import { ContentPage } from "./content-page";
import { FactList } from "./fact-list";
import { FlowDiagram } from "./viz/viz";
import { JsonLd, pageJsonLd } from "./json-ld";
import { RichText } from "./rich-text";
import { Sources } from "./sources";

/**
 * «Sicurezza e privacy» page in one language (`/sicurezza`, `/en/security`), in the home's chapters: the data path as
 * four light rows (what each step does, what it never does, what passes on), what we keep as navy rows with the answer
 * in the display face, the limits on the yellow field, the four controls, then GoCardless and the statistics as
 * folding questions. `path` is the page's own path; all texts come from `content`.
 */
export function SecurityPage({ content, path, home }: { content: SecurityContent; path: string; home: string }) {
  const { page, locale, flow, stored, limits, controls } = content;
  return (
    <ContentPage title={page.h1} lead={page.lead} current={path} locale={locale} alternate={counterpart(path, otherLocale(locale))} disclaimer={false} wide crumbs={[{ href: home, label: "BuddyBudget" }, { label: page.crumb }]} ctaTitle={page.ctaTitle} ctaText={page.ctaText} ctaLocation="sicurezza">
      <JsonLd data={pageJsonLd({ locale, path, title: page.title, description: page.description })} />

      <section className="sp-sec sp-first" aria-labelledby="sp-flow">
        <h2 id="sp-flow">{flow.title}</h2>
        <p className="sp-lede">{flow.lede}</p>
        <FlowDiagram steps={flow.nodes} links={flow.links} description={flow.diagram} />
        <ol className="sp-path">
          {flow.nodes.map((n, i) => (
            <li key={n.id} className="sp-step">
              <div className="sp-step-name">
                <h3>{n.label}</h3>
                <p>{n.role}</p>
              </div>
              <div className="sp-step-text">
                {n.sees.map((s) => <p key={s}>{s}</p>)}
                <p className="sp-never"><strong>{flow.neverTitle}</strong> {n.never.join(" ")}</p>
                {flow.links[i] ? <p className="sp-pass"><ArrowDown size={16} aria-hidden="true" />{flow.links[i]}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="sp-sec sp-bleed sp-stored" data-field="navy" aria-labelledby="sp-stored">
        <div className="sp-in">
          <h2 id="sp-stored">{stored.title}</h2>
          <dl className="sp-rows">
            {stored.rows.map((row) => (
              <div key={row.what} className="sp-row">
                <dt>{row.what}</dt>
                <dd className={`sp-kept sp-kept-${row.kept}`}>{row.keptLabel}</dd>
                <dd className="sp-detail">{row.detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="sp-sec sp-bleed sp-limits" data-field="sun" aria-labelledby="sp-limits">
        <div className="sp-in">
          <h2 id="sp-limits">{limits.title}</h2>
          <div className="sp-pair">
            {limits.items.map((item) => (
              <div key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sp-sec" aria-labelledby="sp-controls">
        <h2 id="sp-controls">{controls.title}</h2>
        <div className="sp-grid">
          {controls.items.map((item) => (
            <div key={item.title} className="sp-cell">
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="sp-sec" aria-labelledby="sp-more">
        <h2 id="sp-more">{page.more}</h2>
        <div className="faq-list sp-questions">
          {[content.gocardless, content.ai, content.analytics].map((q) => (
            <details key={q.question} className="faq-item">
              <summary>{q.question}</summary>
              <div className="sp-answer">
                <p>{q.lede}</p>
                <FactList rows={q.rows} />
                <p className="sp-note"><RichText parts={q.note} /></p>
              </div>
            </details>
          ))}
        </div>
        <p className="sp-note sp-legal"><RichText parts={page.legalNote} /></p>
      </section>

      <Sources items={Object.values(content.sources)} checked={content.sourcesChecked} summary={page.sourcesSummary} locale={locale} />
    </ContentPage>
  );
}
