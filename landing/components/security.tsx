import "./security.css";
import "./security-art.css";
import Link from "next/link";
import { LEGAL_PATHS } from "@/content/legal";
import { SECURITY, SOURCE_URL } from "@/content/site";
import { Reveal } from "./reveal";
import { SecurityCard } from "./security-card";
import { ServerMap } from "./server-map";
import { TrackedSection } from "./tracked-section";

/** Sezione "Sicurezza e privacy": quattro impegni concreti sui dati, con rimando all'informativa. */
export function Security() {
  return (
    <TrackedSection id="sicurezza" section="sicurezza" className="sec sec-security band">
      <div className="wrap" style={{ paddingTop: 0 }}>
        <div className="kicker">{SECURITY.kicker}</div>
        <h2 className="t">{SECURITY.title}</h2>
        <p className="sec-intro">{SECURITY.intro}</p>
        <div className="sec-layout">
        <ServerMap />
        <Reveal stagger className="sec-grid">
          {SECURITY.points.map((point) => (
            <SecurityCard key={point.title} point={point} />
          ))}
        </Reveal>
        </div>
        <p className="fine">
          {SOURCE_URL ? (
            <>
              {SECURITY.sourceNote} <a href={SOURCE_URL} rel="noopener">leggilo su GitHub</a>.{" "}
            </>
          ) : null}
          {SECURITY.legalNote} <Link href={LEGAL_PATHS.privacy}>informativa privacy</Link>.
        </p>
      </div>
    </TrackedSection>
  );
}
