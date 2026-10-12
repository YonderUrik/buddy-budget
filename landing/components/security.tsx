import "./security.css";
import Link from "next/link";
import { LEGAL_PATHS } from "@/content/legal";
import { CONTENT_PATHS } from "@/content/seo-pages";
import { SECURITY } from "@/content/site";
import { DataFlow } from "./data-flow";
import { HomeIcon } from "./home-icon";
import { Reveal } from "./reveal";
import { TrackedSection } from "./tracked-section";

/** Sezione "Sicurezza e privacy": percorso dei dati (diagramma), fatti con fonte, quattro impegni concreti, il limite principale e il rimando alla pagina /sicurezza. */
export function Security({ content = SECURITY }: { content?: typeof SECURITY }) {
  return (
    <TrackedSection id="sicurezza" section="sicurezza" className="sec sec-security">
      <div className="wrap">
        <span className="ref">Privacy e sicurezza</span>
        <h2 className="t">{content.title}</h2>
        <p className="lede">{content.intro}</p>
        <DataFlow />
        <ul className="sec-facts">
          {content.facts.map((fact) => (
            <li key={fact.text}>
              <a href={fact.source} rel="noopener" target="_blank">{fact.text}<span className="sr"> (fonte ufficiale)</span></a>
            </li>
          ))}
        </ul>
        <Reveal stagger className="sec-grid">
          {content.points.map((point) => (
            <article key={point.title} className="sec-point cell">
              <span className="sec-ic" aria-hidden="true"><HomeIcon name={point.icon} size={20} /></span>
              <h3>{point.title}</h3>
              <p>{point.text}</p>
            </article>
          ))}
        </Reveal>
        <p className="sec-limit">{content.limit}</p>
        <p className="sec-more"><Link href={CONTENT_PATHS.sicurezza}>{content.more} →</Link></p>
        <p className="sec-legal">
          {content.legalNote} <Link href={LEGAL_PATHS.privacy}>informativa privacy</Link>.
        </p>
      </div>
    </TrackedSection>
  );
}
