import Link from "next/link";
import { AppShot } from "./app-shot";
import { ContentPage } from "./content-page";
import { JsonLd } from "./json-ld";
import { Sources } from "./sources";
import { counterpart } from "@/content/locales";
import type { InvestmentsPageContent } from "@/content/feature-investments";
import { SITE_URL } from "@/content/site";
import { otherLocale, SCHEMA_LANGUAGE } from "@/lib/i18n";

/** Investments feature page in one language: the real screen, four blocks, the free tools and the legal sources. */
export function InvestmentsPage({ content: c }: { content: InvestmentsPageContent }) {
  const features = c.crumbs.find((crumb, i) => i > 0 && crumb.href)?.href;
  return (
    <ContentPage title={c.h1} lead={c.lead} current={features} locale={c.locale} alternate={counterpart(c.path, otherLocale(c.locale))} crumbs={c.crumbs} ctaTitle={c.ctaTitle} ctaText={c.ctaText} ctaLocation="funzione_investimenti">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebPage", name: c.title, description: c.description, url: `${SITE_URL}${c.path}`, inLanguage: SCHEMA_LANGUAGE[c.locale] }} />
      <AppShot id="investimenti" className="cp-shot" locale={c.locale} priority />
      <div className="fn-grid">
        {c.blocks.map((b) => (
          <div key={b.title} className="fn-card"><h3>{b.title}</h3><p>{b.text}</p></div>
        ))}
      </div>
      <h2>{c.toolsTitle}</h2>
      <div className="related">
        {c.tools.map((t) => (
          <Link key={t.href} href={t.href}>{t.title}<span>{t.text}</span></Link>
        ))}
      </div>
      <Sources items={c.sources} checked={c.sourcesChecked} locale={c.locale} />
    </ContentPage>
  );
}
