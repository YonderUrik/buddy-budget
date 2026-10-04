import "./features-section.css";
import Link from "next/link";
import { FEATURE_AREAS, featureCounts, featuresByArea } from "@/content/catalog.generated";
import { CONTENT_PATHS } from "@/content/seo-pages";
import { ARROW_ICON } from "./cta-link";
import { TrackedSection } from "./tracked-section";

/** Funzioni mostrate per area prima del rimando all'elenco completo. */
const SAMPLE_PER_AREA = 3;

/** "Cosa c'è dentro": le aree dell'app con qualche funzione ciascuna, tratte dal catalogo (unica fonte), e il rimando all'elenco completo. */
export function FeaturesSection() {
  const { total, available } = featureCounts();
  return (
    <TrackedSection id="funzioni" section="funzioni" className="sec sec-features band">
      <div className="wrap">
        <h2 className="t">Cosa c&apos;è dentro.</h2>
        <p className="lede">{available} funzioni già disponibili, altre {total - available} in arrivo. Qui le aree; nell&apos;elenco completo c&apos;è ogni funzione.</p>
        <div className="areas-list">
          {FEATURE_AREAS.map((area) => {
            const features = featuresByArea(area).filter((f) => f.status !== "soon");
            return (
              <section key={area}>
                <h3>{area}</h3>
                <ul>
                  {features.slice(0, SAMPLE_PER_AREA).map((f) => (
                    <li key={f.id}>{f.name}</li>
                  ))}
                </ul>
                <span className="areas-more">{features.length > SAMPLE_PER_AREA ? `e altre ${features.length - SAMPLE_PER_AREA}` : " "}</span>
              </section>
            );
          })}
        </div>
        <div className="cta" style={{ marginTop: 40 }}>
          <Link className="btn ghost" href={CONTENT_PATHS.funzioni}>Tutte le funzioni{ARROW_ICON}</Link>
          <Link className="btn ghost" href={CONTENT_PATHS.schermate}>Tutte le schermate{ARROW_ICON}</Link>
        </div>
      </div>
    </TrackedSection>
  );
}
