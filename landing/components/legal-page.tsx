import "./legal-page.css";
import { LEGAL_OWNER, LEGAL_VERSION, type LegalDocument } from "@/content/legal";
import { HOME_PATH } from "@/content/locales";
import type { Locale } from "@/lib/i18n";
import { SiteNav } from "./site-nav";
import { SiteFooter } from "./site-footer";
import { BackLink } from "./back-link";

/**
 * Testo con l'indirizzo del titolare reso come link `mailto:`. Il marcatore `email_off` impedisce a Cloudflare di sostituirlo con
 * `/cdn-cgi/l/email-protection`, un link che i crawler (e l'audit SEO) vedono rotto (404) perché risolto solo da uno script.
 */
function RichText({ text }: { text: string }) {
  const [before, ...rest] = text.split(LEGAL_OWNER.email);
  if (rest.length === 0) return <>{text}</>;
  const link = `<!--email_off--><a href="mailto:${LEGAL_OWNER.email}">${LEGAL_OWNER.email}</a><!--/email_off-->`;
  return (
    <>
      {before}
      {rest.map((part, i) => (
        <span key={i}>
          <span style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: link }} />
          {part}
        </span>
      ))}
    </>
  );
}

/** Chrome texts of the legal pages, per language. */
const LEGAL_UI: Record<Locale, { version: string; toc: string }> = {
  it: { version: "Versione del", toc: "Indice" },
  en: { version: "Version of", toc: "Contents" },
};

export interface LegalPageProps {
  doc: LegalDocument;
  locale?: Locale;
  /** The same page in the other language, for the language menu. */
  alternate?: string;
}

/** Page of a legal document: navy head with title and version, then the intro, the index and the numbered sections. */
export function LegalPage({ doc, locale = "it", alternate }: LegalPageProps) {
  const t = LEGAL_UI[locale];
  return (
    <>
      <SiteNav locale={locale} alternate={alternate} />
      <main className="legal">
        <header className="legal-head">
          <div className="wrap legal-wrap">
            <BackLink href={HOME_PATH[locale]} label="Home" />
            <h1>{doc.title}</h1>
            <p className="legal-meta">{t.version} {LEGAL_VERSION}</p>
          </div>
        </header>
        <div className="wrap legal-wrap">
          <p className="legal-intro">{doc.intro}</p>
          <nav className="legal-toc" aria-label={t.toc}>
            <ol>
              {doc.sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>{section.title}</a>
                </li>
              ))}
            </ol>
          </nav>
          {doc.sections.map((section, index) => (
            <section key={section.id} id={section.id}>
              <h2>
                {index + 1}. {section.title}
              </h2>
              {section.paragraphs?.map((text) => <p key={text}><RichText text={text} /></p>)}
              {section.items ? (
                <ul>
                  {section.items.map((text) => (
                    <li key={text}><RichText text={text} /></li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      </main>
      <SiteFooter locale={locale} alternate={alternate} />
    </>
  );
}
