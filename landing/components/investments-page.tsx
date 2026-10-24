import Link from "next/link";
import { AppShot } from "./app-shot";
import { ContentPage } from "./content-page";
import { JsonLd, pageJsonLd } from "./json-ld";
import { Sources } from "./sources";
import { counterpart } from "@/content/locales";
import type { InvestmentsPageContent } from "@/content/feature-investments";
import { RULES_NOTES } from "@/content/rules-needs";
import { otherLocale } from "@/lib/i18n";
import { needsAttr } from "@/lib/visitor-country";
import { RulesNote } from "./by-rules";

/**
 * Investments feature page in one language: the real screen, four blocks, the free tools and the legal sources. The
 * tax blocks, tools and sources hide for visitors from a country without tax rules yet, who get one line instead.
 */
export function InvestmentsPage({ content: c }: { content: InvestmentsPageContent }) {
  const features = c.crumbs.find((crumb, i) => i > 0 && crumb.href)?.href;
  return (
    <ContentPage title={c.h1} lead={c.lead} current={features} locale={c.locale} alternate={counterpart(c.path, otherLocale(c.locale))} crumbs={c.crumbs} ctaTitle={c.ctaTitle} ctaText={c.ctaText} ctaLocation="funzione_investimenti">
      <JsonLd data={pageJsonLd({ locale: c.locale, path: c.path, title: c.title, description: c.description })} />
      <AppShot id="investimenti" className="cp-shot" locale={c.locale} priority />
      <div className="fn-grid">
        {c.blocks.map((b) => (
          <div key={b.title} className="fn-card" data-needs={needsAttr(b.needs)}><h3>{b.title}</h3><p>{b.text}</p></div>
        ))}
      </div>
      <RulesNote text={RULES_NOTES[c.locale].taxes} />
      <h2 data-needs="taxes">{c.toolsTitle}</h2>
      <div className="related" data-needs="taxes">
        {c.tools.map((t) => (
          <Link key={t.href} href={t.href}>{t.title}<span>{t.text}</span></Link>
        ))}
      </div>
      <Sources items={c.sources} checked={c.sourcesChecked} locale={c.locale} needs="taxes" />
    </ContentPage>
  );
}
