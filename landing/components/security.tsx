import "./security.css";
import Link from "next/link";
import { LEGAL_PATHS } from "@/content/legal";
import { SECURITY } from "@/content/site";
import { Reveal } from "./reveal";
import { HomeIcon } from "./home-icon";
import { ServerMap } from "./server-map";
import { TrackedSection } from "./tracked-section";

/** Sezione "Sicurezza e privacy": quattro impegni concreti sui dati, con rimando all'informativa. */
export function Security() {
  return (
    <TrackedSection id="sicurezza" section="sicurezza" className="sec sec-security band">
      <div className="wrap" style={{ paddingTop: 0 }}>
        <h2 className="t">{SECURITY.title}</h2>
        <p className="sec-intro">{SECURITY.intro}</p>
        <div className="sec-layout">
        <ServerMap />
        <Reveal stagger className="sec-grid">
          {SECURITY.points.map((point) => (
            <article key={point.title} className="sec-point">
              <span className="sec-ic" aria-hidden="true"><HomeIcon name={point.icon} size={22} /></span>
              <h3>{point.title}</h3>
              <p>{point.text}</p>
            </article>
          ))}
        </Reveal>
        </div>
        <p className="fine">
          {SECURITY.legalNote} <Link href={LEGAL_PATHS.privacy}>informativa privacy</Link>.
        </p>
      </div>
    </TrackedSection>
  );
}
