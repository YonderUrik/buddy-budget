import "./security.css";
import Link from "next/link";
import { CONTENT_PATHS } from "@/content/seo-pages";
import { SECURITY, SOURCE_URL, SUPPORT_EMAIL } from "@/content/site";
import { MailLink } from "./mail-link";
import { SourceLink } from "./source-link";
import { DataFlow } from "./data-flow";
import { TrackedSection } from "./tracked-section";

/** Sezione "Sicurezza e privacy" della home, volutamente breve: percorso dei dati (diagramma), tre fatti con fonte, chi c'è dietro con un contatto e il rimando alla pagina /sicurezza, dove sta tutto il resto. */
export function Security({ content = SECURITY }: { content?: typeof SECURITY }) {
  return (
    <TrackedSection id="sicurezza" section="sicurezza" className="sec sec-security">
      <div className="wrap">
        <span className="ref">Privacy e sicurezza</span>
        <h2 className="t">{content.title}</h2>
        <p className="lede">{content.intro}</p>
        <h3 id="come-si-collega" className="sec-steps-title">{content.stepsTitle}</h3>
        <ol className="sec-steps">
          {content.steps.map((step, i) => (
            <li key={step.title} className="cell">
              <span className="sec-step-n" aria-hidden="true">{i + 1}</span>
              <b>{step.title}</b>
              <span>{step.text}</span>
            </li>
          ))}
        </ol>
        <DataFlow />
        <ul className="sec-facts">
          {content.facts.map((fact) => (
            <li key={fact.text}>
              <a href={fact.source} rel="noopener" target="_blank">{fact.text}<span className="sr"> (fonte ufficiale)</span></a>
            </li>
          ))}
        </ul>
        <div className="sec-who cell">
          <h3>{content.who.title}</h3>
          <p>
            {content.who.text} <MailLink email={SUPPORT_EMAIL} /> {content.who.tail}
            {SOURCE_URL && (
              <>
                {" "}<SourceLink href={SOURCE_URL} location="sezione">Vedi il codice</SourceLink>
              </>
            )}
          </p>
        </div>
        <p className="sec-more"><Link href={CONTENT_PATHS.sicurezza}>{content.more} →</Link></p>
      </div>
    </TrackedSection>
  );
}
