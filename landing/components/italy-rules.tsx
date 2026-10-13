import "./italy-rules.css";
import Link from "next/link";
import { ITALY } from "@/content/home";
import { HomeIcon } from "./home-icon";
import { Reveal } from "./reveal";
import { TrackedSection } from "./tracked-section";

/**
 * "Le regole italiane, già nei conti" come tabella: la regola, cosa ne fa l'app, il calcolatore gratuito collegato (se
 * esiste) e la fonte ufficiale. È il vantaggio che le app straniere non hanno, e la parte più citabile della pagina.
 */
export function ItalyRules({ content = ITALY }: { content?: typeof ITALY }) {
  return (
    <TrackedSection id="italia" section="italia" className="sec italy">
      <div className="wrap">
        <span className="ref">{content.kicker}</span>
        <h2 className="t">{content.title}</h2>
        <p className="lede">{content.lede}</p>
        <Reveal className="it-wrap cell">
          <table className="it">
            <thead>
              <tr>
                <th scope="col">La regola</th>
                <th scope="col">Cosa calcola l&apos;app per te</th>
                <th scope="col"><span className="sr">Approfondimenti</span></th>
              </tr>
            </thead>
            <tbody>
              {content.rules.map((r) => (
                <tr key={r.rule}>
                  <th scope="row">
                    <span className="it-rule">
                      <span className="it-ic" aria-hidden="true"><HomeIcon name={r.icon} size={18} /></span>
                      {r.rule}
                    </span>
                  </th>
                  <td>{r.app}</td>
                  <td className="it-links">
                    {r.link ? <Link href={r.link.href}>{r.link.label} →</Link> : null}
                    {r.source ? (
                      <a href={r.source.href} rel="noopener" title={r.source.label} aria-label={`Fonte: ${r.source.label}`}>Fonte</a>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
      </div>
    </TrackedSection>
  );
}
