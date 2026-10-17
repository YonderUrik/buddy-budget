import Link from "next/link";
import { TRUST, UNDER_HOOD } from "@/content/home";
import { CONTENT_PATHS } from "@/content/seo-pages";
import { SOURCE_LICENSE, SOURCE_URL, SUPPORT_EMAIL } from "@/content/site";
import { GithubMark } from "../github-mark";
import { HomeIcon } from "../home-icon";
import { SourceLink } from "../source-link";
import { TrackedSection } from "../tracked-section";
import { SectionHead } from "./section-head";

/** «Legge soltanto. Non sposta soldi.»: four facts with their sources, two limits said plainly, then the code. */
export function Trust() {
  return (
    <TrackedSection id="sicurezza" section="sicurezza" className="sec" aria-labelledby="sicurezza-t">
      <div className="wrap">
        <SectionHead id="sicurezza-t" title={TRUST.title} intro={TRUST.intro} />
        <ul className="facts">
          {TRUST.facts.map((fact) => (
            <li key={fact.title}>
              <span className="ic" aria-hidden="true"><HomeIcon name={fact.icon} size={18} /></span>
              <h3>{fact.title}</h3>
              <p>{fact.text}</p>
              {fact.source ? (
                <p className="src">
                  <a href={fact.source.href} target="_blank" rel="noopener noreferrer">{fact.source.label}</a>
                </p>
              ) : null}
            </li>
          ))}
        </ul>
        <ul className="limits">
          {TRUST.limits.map((limit) => (
            <li key={limit.title}>
              <h3>{limit.title}</h3>
              <p>{limit.text}</p>
            </li>
          ))}
        </ul>
        <Link className="more" href={CONTENT_PATHS.sicurezza}>{TRUST.more}</Link>
        <UnderHood />
      </div>
    </TrackedSection>
  );
}

/** «Sotto il cofano»: license, stack and the facts a tinkerer checks; with the public repository, the links to read or install it. */
function UnderHood() {
  const o = UNDER_HOOD;
  return (
    <TrackedSection id="codice" section="codice" as="div" className="hood" aria-labelledby="codice-t">
      <div>
        <GithubMark className="ghm" />
        <h2 id="codice-t">{o.title}</h2>
        <p>{SOURCE_URL ? o.text : `Il codice ha licenza ${SOURCE_LICENSE} e si installa su un server tuo con Docker.`}</p>
        {SOURCE_URL ? (
          <div className="cta">
            <SourceLink className="btn ghost" href={SOURCE_URL} location="sezione">
              <GithubMark />
              {o.cta}
            </SourceLink>
            <a className="btn plain" href={`${SOURCE_URL}${o.selfHostPath}`} target="_blank" rel="noopener noreferrer">{o.selfHost}</a>
          </div>
        ) : null}
        <p className="who">
          {o.who} <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> {o.whoTail}
        </p>
      </div>
      <dl>
        {o.facts.map((fact) => (
          <div key={fact.label} style={{ display: "contents" }}>
            <dt>{fact.label}</dt>
            <dd>{SOURCE_URL && fact.path ? <a href={`${SOURCE_URL}${fact.path}`} target="_blank" rel="noopener noreferrer">{fact.value}</a> : fact.value}</dd>
          </div>
        ))}
      </dl>
    </TrackedSection>
  );
}
