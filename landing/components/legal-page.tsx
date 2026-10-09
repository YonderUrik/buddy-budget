import "./legal-page.css";
import { LEGAL_DRAFT, LEGAL_VERSION, type LegalDocument } from "@/content/legal";
import { SiteNav } from "./site-nav";
import { SiteFooter } from "./site-footer";

/** Pagina di un documento legale: intestazione con marchio, avviso di bozza, indice e sezioni numerate. */
export function LegalPage({ doc }: { doc: LegalDocument }) {
  return (
    <>
      <SiteNav />
      <main className="legal">
        <div className="wrap legal-wrap">
          {LEGAL_DRAFT ? (
            <p className="legal-draft" role="note">
              Bozza in revisione: questo testo non è ancora definitivo e alcuni dati sono segnaposto.
            </p>
          ) : null}
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
              {section.paragraphs?.map((text) => <p key={text}>{text}</p>)}
              {section.items ? (
                <ul>
                  {section.items.map((text) => (
                    <li key={text}>{text}</li>
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
