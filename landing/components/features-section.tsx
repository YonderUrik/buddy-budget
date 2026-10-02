import { featureCounts } from "@/content/catalog.generated";
import { Bento } from "./bento";
import { FeatureCatalog } from "./feature-catalog";
import { TrackedSection } from "./tracked-section";

/** Sezione "Dentro l'app": riquadri vivi e catalogo completo. */
export function FeaturesSection() {
  const { total } = featureCounts();
  return (
    <TrackedSection id="funzioni" section="funzioni" className="sec">
      <div className="wrap">
        <div className="kicker">Dentro l&apos;app</div>
        <h2 className="t">Pensato nei dettagli.</h2>
        <Bento />
        <div style={{ marginTop: 150 }}>
          <div className="kicker">Tutte le funzioni</div>
          <h2 className="t">{total} funzioni, e il numero cresce a ogni uscita.</h2>
          <p className="lede">L&apos;elenco è lo stesso che usa l&apos;app: quando ne aggiungiamo una, compare qui.</p>
          <FeatureCatalog />
        </div>
      </div>
    </TrackedSection>
  );
}
