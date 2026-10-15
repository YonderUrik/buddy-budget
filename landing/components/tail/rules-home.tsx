import Link from "next/link";
import { ITALY } from "@/content/home";
import { RULES_HOME } from "@/content/story";
import { TrackedSection } from "../tracked-section";

/** «Le regole italiane sono già nei conti»: la regola, cosa ne fa l'app, il calcolatore collegato e la fonte ufficiale, in due colonne di righe. */
export function RulesHome() {
  return (
    <TrackedSection id="regole" section="regole">
      <div className="wrap">
        <h2>{RULES_HOME.title}</h2>
        <p className="intro">{RULES_HOME.intro}</p>
        <ul className="rules2">
          {ITALY.rules.map((r) => (
            <li key={r.rule}>
              <b>{r.rule}</b>
              <p>{r.app}</p>
              {r.link || r.source ? (
                <p className="links">
                  {r.link ? <Link href={r.link.href}>{r.link.label} →</Link> : null}
                  {r.source ? <a className="src" href={r.source.href} target="_blank" rel="noopener noreferrer" title={r.source.label}>Fonte</a> : null}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </TrackedSection>
  );
}
