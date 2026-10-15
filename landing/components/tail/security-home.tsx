import { t as trLanding } from "@/lib/localization";
import Link from "next/link";
import { OPEN_SOURCE, SECURITY_HOME } from "@/content/story";
import { CONTENT_PATHS } from "@/content/seo-pages";
import { SOURCE_URL, SUPPORT_EMAIL } from "@/content/site";
import { GithubMark } from "../github-mark";
import { HomeIcon } from "../home-icon";
import { SourceLink } from "../source-link";
import { TrackedSection } from "../tracked-section";

/** Nome del repository («utente/repo») ricavato dall'indirizzo pubblico del codice. */
function repoName(url: string): string {
  try {
    return new URL(url).pathname.replace(/^\/|\/$/g, "") || url;
  } catch {
    return url;
  }
}

/** «La sicurezza, in chiaro»: cinque righe verificate (PSD2, cifratura, dove stanno i dati, cosa non si salva, cosa controlli), i limiti dichiarati e, con il repository pubblico, il blocco del codice aperto. */
export function SecurityHome() {
  const s = SECURITY_HOME;
  return (
    <TrackedSection id="sicurezza" section="sicurezza" className="sicurezza">
      <div className="wrap">
        <h2>{trLanding(s.title)}</h2>
        <p className="intro">{trLanding(s.intro)}</p>
        <ul className="rows">
          {s.rows.map((row) => (
            <li key={row.title}>
              <h3>
                <span className="ic" aria-hidden="true"><HomeIcon name={row.icon} size={18} /></span>
                {trLanding(row.title)}
              </h3>
              <div>
                <p>{trLanding(row.text)}</p>
                {row.sources ? (
                  <p className="src">
                    {row.sources.map((src, i) => (
                      <span key={src.href}>
                        {trLanding(i > 0 ? " · " : "")}
                        <a href={src.href} target="_blank" rel="noopener noreferrer">{trLanding(src.label)}</a>
                      </span>
                    ))}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        <Link className="more" href={CONTENT_PATHS.sicurezza}>{trLanding(s.moreLabel)}</Link>
        <div className="limits">
          {s.limits.map((l) => (
            <div key={l.title}>
              <h3>{trLanding(l.title)}</h3>
              <p>{trLanding(l.text)}</p>
            </div>
          ))}
        </div>
        {SOURCE_URL ? <OpenSource /> : null}
      </div>
    </TrackedSection>
  );
}

/** Il codice aperto: cosa puoi farci, i due pulsanti e la scheda del repository con licenza e documenti. Solo con `NEXT_PUBLIC_SOURCE_URL`. */
function OpenSource() {
  const o = OPEN_SOURCE;
  return (
    <TrackedSection id="codice" section="codice" as="div" className="oss">
      <div>
        <GithubMark className="ghm" />
        <h2>{trLanding(o.title)}</h2>
        <p>{trLanding(o.text)}</p>
        <div className="cta">
          <SourceLink className="btn ghost" href={SOURCE_URL} location="sezione">
            <GithubMark />
            {trLanding(o.cta)}
          </SourceLink>
          <a className="btn ghost" href={`${SOURCE_URL}${o.selfHostPath}`} target="_blank" rel="noopener noreferrer">{trLanding(o.selfHost)} →</a>
        </div>
        <p className="who">
          {trLanding(o.who)} <a href={`mailto:${SUPPORT_EMAIL}`}>{trLanding(SUPPORT_EMAIL)}</a>{trLanding(o.whoTail)}
        </p>
      </div>
      <div className="repo">
        <div className="h">
          <GithubMark />
          {trLanding(repoName(SOURCE_URL))} <small>· {trLanding(o.repoLabel)}</small>
        </div>
        <ul>
          {o.facts.map((f) => (
            <li key={f.label}>
              <span>{trLanding(f.label)}</span>
              {"path" in f ? <a href={`${SOURCE_URL}${f.path}`} target="_blank" rel="noopener noreferrer">{trLanding(f.value)}</a> : <b>{trLanding(f.value)}</b>}
            </li>
          ))}
        </ul>
      </div>
    </TrackedSection>
  );
}
