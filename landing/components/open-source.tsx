import "./open-source.css";
import { OPEN_SOURCE, SOURCE_LICENSE, SOURCE_URL } from "@/content/site";
import { GithubMark } from "./github-mark";
import { HomeIcon } from "./home-icon";
import { Reveal } from "./reveal";
import { SourceLink } from "./source-link";
import { TrackedSection } from "./tracked-section";

/** Blocco «Codice aperto»: link al repository, licenza e tre cose che chiunque può verificare leggendo il codice. Senza `SOURCE_URL` non appare. */
export function OpenSource() {
  if (!SOURCE_URL) return null;
  return (
    <TrackedSection id="codice" section="codice" className="sec sec-os">
      <div className="wrap" style={{ paddingTop: 0 }}>
        <div className="os-layout">
          <Reveal className="os-text">
            <span className="kicker">{OPEN_SOURCE.kicker}</span>
            <h2 className="t" style={{ marginTop: 12 }}>{OPEN_SOURCE.title}</h2>
            <p className="lede">{OPEN_SOURCE.intro}</p>
            <div className="cta">
              <SourceLink href={SOURCE_URL} location="sezione" className="btn main os-btn">
                <GithubMark />
                {OPEN_SOURCE.cta}
              </SourceLink>
              <span className="os-license">{SOURCE_LICENSE}</span>
            </div>
          </Reveal>
          <Reveal className="os-repo" distance={28}>
            <div className="os-repo-head">
              <GithubMark className="os-mark" />
              <span className="os-repo-name">{OPEN_SOURCE.repoName}</span>
              <span className="os-repo-meta">{SOURCE_LICENSE} · pubblico</span>
            </div>
            <ul className="os-points">
              {OPEN_SOURCE.points.map((p) => (
                <li key={p.title}>
                  <span className="os-ic" aria-hidden="true"><HomeIcon name={p.icon} size={20} /></span>
                  <div>
                    <h3>{p.title}</h3>
                    <p>{p.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </TrackedSection>
  );
}
