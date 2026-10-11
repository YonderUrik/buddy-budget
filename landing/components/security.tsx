import "./security.css";
import Link from "next/link";
import { LEGAL_PATHS } from "@/content/legal";
import { SECURITY } from "@/content/site";
import { HomeIcon } from "./home-icon";
import { Reveal } from "./reveal";
import { TrackedSection } from "./tracked-section";

/** Sezione "Sicurezza e privacy": quattro impegni concreti sui dati in quattro celle affiancate, con rimando all'informativa. */
export function Security({ content = SECURITY }: { content?: typeof SECURITY }) {
  return (
    <TrackedSection id="sicurezza" section="sicurezza" className="sec sec-security">
      <div className="wrap">
        <span className="ref">Privacy e sicurezza</span>
        <h2 className="t">{content.title}</h2>
        <p className="lede">{content.intro}</p>
        <Reveal stagger className="sec-grid">
          {content.points.map((point) => (
            <article key={point.title} className="sec-point cell">
              <span className="sec-ic" aria-hidden="true"><HomeIcon name={point.icon} size={20} /></span>
              <h3>{point.title}</h3>
              <p>{point.text}</p>
            </article>
          ))}
        </Reveal>
        <p className="sec-legal">
          {content.legalNote} <Link href={LEGAL_PATHS.privacy}>informativa privacy</Link>.
        </p>
      </div>
    </TrackedSection>
  );
}
