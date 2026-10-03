import Link from "next/link";
import { CONTENT_PATHS } from "@/content/seo-pages";
import { ARROW_ICON } from "./cta-link";
import { Bento } from "./bento";
import { TrackedSection } from "./tracked-section";

/** Sezione "Dentro l'app": i riquadri con le funzioni più riconoscibili, con rimando all'elenco completo e alle schermate. */
export function FeaturesSection() {
  return (
    <TrackedSection id="funzioni" section="funzioni" className="sec">
      <div className="wrap">
        <div className="kicker">Dentro l&apos;app</div>
        <h2 className="t">Pensato nei dettagli.</h2>
        <Bento />
        <div className="cta" style={{ marginTop: 48 }}>
          <Link className="btn ghost" href={CONTENT_PATHS.funzioni}>Tutte le funzioni{ARROW_ICON}</Link>
          <Link className="btn ghost" href={CONTENT_PATHS.schermate}>Tutte le schermate{ARROW_ICON}</Link>
        </div>
      </div>
    </TrackedSection>
  );
}
