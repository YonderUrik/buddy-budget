import { t as trLanding, PROFILE } from "@/lib/localization";
import Link from "next/link";
import { ITALY } from "@/content/home";
import { RULES_HOME } from "@/content/story";
import { TrackedSection } from "../tracked-section";

/** «Le regole italiane sono già nei conti»: la regola, cosa ne fa l'app, il calcolatore collegato e la fonte ufficiale, in due colonne di righe. */
export function RulesHome() {
  if (PROFILE.country === "DE") return <TrackedSection id="regole" section="regole"><div className="wrap"><h2>{trLanding("Il prodotto Germania, senza confondere le regole.")}</h2><p className="intro">{trLanding("Conti, budget, investimenti, rendimenti e debiti sono disponibili. Le stime fiscali sono parziali e indicano i dati necessari e i propri limiti.")}</p><p>{trLanding("Pensione, AVD e simulatori avanzati sono nascosti in attesa di revisione. Le aliquote e i calcolatori fiscali italiani non vengono applicati al prodotto Germania.")}</p></div></TrackedSection>;
  return (
    <TrackedSection id="regole" section="regole">
      <div className="wrap">
        <h2>{trLanding(RULES_HOME.title)}</h2>
        <p className="intro">{trLanding(RULES_HOME.intro)}</p>
        <ul className="rules2">
          {ITALY.rules.map((r) => (
            <li key={r.rule}>
              <b>{trLanding(r.rule)}</b>
              <p>{trLanding(r.app)}</p>
              {r.link || r.source ? (
                <p className="links">
                  {r.link ? <Link href={r.link.href}>{trLanding(r.link.label)} →</Link> : null}
                  {r.source ? <a className="src" href={r.source.href} target="_blank" rel="noopener noreferrer" title={trLanding(r.source.label)}>{trLanding("Fonte")}</a> : null}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </TrackedSection>
  );
}
