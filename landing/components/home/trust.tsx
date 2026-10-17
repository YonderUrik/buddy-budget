import Link from "next/link";
import type { HoodText, TrustText } from "@/content/home";
import { SOURCE_URL, SUPPORT_EMAIL } from "@/content/site";
import { rise } from "@/lib/motion/rise";
import { GithubMark } from "../github-mark";
import { SourceLink } from "../source-link";
import { TrackedSection } from "../tracked-section";
import { CopyCommand } from "./copy-command";

/**
 * «Cosa fa l'app con i tuoi dati» (taste-skill section «Statement cell, dark rows»): a light cell with the heading in
 * three zigzag lines, the two plain sentences and the link to the full page, butted against a navy cell of rows (four
 * facts, then the limits) told apart by two navy tones, never by lines. Each row: title, one paragraph, three plain
 * terms. Below, the code itself: the links to read it and the commands to run it at home.
 */
export function Trust({ text, hood }: { text: TrustText; hood: HoodText }) {
  return (
    <TrackedSection id="sicurezza" section="sicurezza" className="sec trust" field="light" aria-labelledby="sicurezza-t">
      <div className="tr-split">
        <div className="tr-cell">
          <h2 id="sicurezza-t" className="tr-title" data-rise>
            <span>{text.title[0]}</span> <span>{text.title[1]}</span> <span>{text.title[2]}</span>
          </h2>
          <div className="tr-foot" data-rise style={rise(1)}>
            <p>{text.lede}</p>
            <Link className="more" href={text.moreHref}>{text.more}</Link>
          </div>
        </div>
        <ul className="tr-rows" data-field="navy">
          {text.facts.map((f) => (
            <li key={f.title} className="tr-row">
              <h3>{f.title}</h3>
              <p>{f.text}</p>
              <p className="tr-terms">
                {f.terms.map((term) => (
                  <span key={term}>{term}</span>
                ))}
                {f.source ? (
                  <a href={f.source.href} target="_blank" rel="noopener noreferrer">{f.source.label}</a>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      </div>
      <div className="wrap">
        <TrackedSection id="codice" section="codice" as="div" className="code" aria-labelledby="codice-t">
          <div data-rise>
            <h3 id="codice-t">{hood.title}</h3>
            <p>{SOURCE_URL ? hood.text : hood.fallback}</p>
            {SOURCE_URL ? (
              <div className="cta">
                <SourceLink className="btn ink" href={SOURCE_URL} location="sezione">
                  <GithubMark />
                  {hood.cta}
                </SourceLink>
                <a className="btn line" href={`${SOURCE_URL}${hood.selfHostPath}`} target="_blank" rel="noopener noreferrer">{hood.selfHost}</a>
              </div>
            ) : null}
            <p className="who">
              {hood.who} <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> {hood.whoTail}
            </p>
          </div>
          {SOURCE_URL ? (
            <div data-rise style={rise(1)}>
              <CopyCommand label={hood.command.label} lines={[`git clone ${SOURCE_URL}.git`, ...hood.command.lines]} copy={hood.command.copy} copied={hood.command.copied} />
            </div>
          ) : null}
        </TrackedSection>
      </div>
    </TrackedSection>
  );
}
