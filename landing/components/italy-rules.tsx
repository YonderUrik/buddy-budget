import "./italy-rules.css";
import Link from "next/link";
import { ITALY } from "@/content/home";
import { HomeIcon } from "./home-icon";
import { Reveal } from "./reveal";
import { TrackedSection } from "./tracked-section";

/**
 * "Le regole italiane, già nei conti": per ogni regola fiscale o bancaria, cosa ne fa l'app, il calcolatore gratuito
 * collegato (se esiste) e la fonte ufficiale. È il vantaggio che le app straniere non hanno, e la parte più citabile della pagina.
 */
export function ItalyRules({ content = ITALY }: { content?: typeof ITALY }) {
  return (
    <TrackedSection id="italia" section="italia" className="sec italy">
      <div className="wrap">
        <span className="kicker">{content.kicker}</span>
        <h2 className="t" style={{ marginTop: 14 }}>{content.title}</h2>
        <p className="lede">{content.lede}</p>
        <Reveal stagger className="italy-grid">
          {content.rules.map((r) => (
            <article key={r.rule} className="italy-card">
              <span className="italy-ic" aria-hidden="true">
                <HomeIcon name={r.icon} size={20} />
              </span>
              <h3>{r.rule}</h3>
              <p>{r.app}</p>
              <div className="italy-links">
                {r.link ? (
                  <Link className="italy-tool" href={r.link.href}>
                    {r.link.label} <em aria-hidden="true">→</em>
                  </Link>
                ) : null}
                {r.source ? (
                  <a className="italy-src" href={r.source.href} rel="noopener" title={r.source.label} aria-label={`Fonte: ${r.source.label}`}>
                    Fonte
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </Reveal>
      </div>
    </TrackedSection>
  );
}
