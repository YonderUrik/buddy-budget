import Link from "next/link";
import type { HoodText, TrustText } from "@/content/home";
import { SOURCE_URL, SUPPORT_EMAIL } from "@/content/site";
import { GithubMark } from "../github-mark";
import { HomeIcon } from "../home-icon";
import { SourceLink } from "../source-link";
import { TrackedSection } from "../tracked-section";
import { CopyCommand } from "./copy-command";
import { SectionHead } from "./section-head";

/** «Legge soltanto. Non sposta soldi.»: four facts with their sources, two limits said plainly, then the code. */
export function Trust({ text, hood }: { text: TrustText; hood: HoodText }) {
  return (
    <TrackedSection id="sicurezza" section="sicurezza" className="sec" aria-labelledby="sicurezza-t">
      <div className="wrap">
        <SectionHead id="sicurezza-t" title={text.title} />
        <ul className="facts">
          {text.facts.map((fact) => (
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
          {text.limits.map((limit) => (
            <li key={limit.title}>
              <h3>{limit.title}</h3>
              <p>{limit.text}</p>
            </li>
          ))}
        </ul>
        <Link className="more" href={text.moreHref}>{text.more}</Link>
        <UnderHood text={hood} />
      </div>
    </TrackedSection>
  );
}

/** «Sotto il cofano»: license, stack and the facts a tinkerer checks; with the public repository, the links to read it and the commands to install it. */
function UnderHood({ text: o }: { text: HoodText }) {
  return (
    <TrackedSection id="codice" section="codice" as="div" className="hood" aria-labelledby="codice-t">
      <div>
        <GithubMark className="ghm" />
        <h2 id="codice-t">{o.title}</h2>
        <p>{SOURCE_URL ? o.text : o.fallback}</p>
        {SOURCE_URL ? (
          <div className="cta">
            <SourceLink className="btn ghost" href={SOURCE_URL} location="sezione">
              <GithubMark />
              {o.cta}
            </SourceLink>
            <a className="btn plain" href={`${SOURCE_URL}${o.selfHostPath}`} target="_blank" rel="noopener noreferrer">{o.selfHost}</a>
          </div>
        ) : null}
        {SOURCE_URL ? (
          <CopyCommand label={o.command.label} lines={[`git clone ${SOURCE_URL}.git`, ...o.command.lines]} copy={o.command.copy} copied={o.command.copied} />
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
