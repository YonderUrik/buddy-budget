import "./legal-page.css";
import { LEGAL_OWNER, LEGAL_VERSION, type LegalDocument } from "@/content/legal";
import { SiteNav } from "./site-nav";
import { SiteFooter } from "./site-footer";

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

/** Pagina di un documento legale: intestazione con marchio, indice e sezioni numerate. */
export function LegalPage({ doc }: { doc: LegalDocument }) {
  return (
    <>
      <SiteNav />
      <main className="legal">
        <div className="wrap legal-wrap">
          <h1>{doc.title}</h1>
          <p className="legal-meta">Versione del {LEGAL_VERSION}</p>
          <p className="legal-intro">{doc.intro}</p>
          <nav className="legal-toc" aria-label="Indice">
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
      <SiteFooter />
    </>
  );
}
