import "./features-section.css";
import Link from "next/link";
import { FEATURE_AREAS, type FeatureArea } from "@/content/catalog.generated";
import { AREA_META } from "@/content/feature-areas";
import { CONTENT_PATHS } from "@/content/seo-pages";
import { ARROW_ICON } from "./cta-link";
import { HomeIcon } from "./home-icon";
import { Reveal } from "./reveal";
import { ToolShot } from "./tool-shot";
import { TrackedSection } from "./tracked-section";

/** Aree mostrate in home: quelle con una schermata vera (Account resta nella pagina delle funzioni). */
const HOME_AREAS: readonly FeatureArea[] = FEATURE_AREAS.filter((a) => AREA_META[a].shot);

/**
 * Le aree dell'app, ognuna con la sua schermata vera, una frase e il rimando alla pagina delle funzioni.
 * Testi e schermate vengono da `AREA_META` (stessa fonte della pagina funzioni): nessun conteggio, nessun elenco da mantenere qui.
 */
export function FeaturesSection() {
  return (
    <TrackedSection id="funzioni" section="funzioni" className="sec sec-features">
      <div className="wrap">
        <h2 className="t">Le aree dell&apos;app.</h2>
        <p className="lede">Si usano una alla volta: parti da quella che ti serve e aggiungi le altre quando vuoi. Insieme compongono il patrimonio netto.</p>
        <Reveal stagger className="areas-grid">
          {HOME_AREAS.map((area) => {
            const meta = AREA_META[area];
            return (
              <Link key={area} href={`${CONTENT_PATHS.funzioni}#${meta.slug}`} className="area-card">
                {meta.shot ? <ToolShot id={meta.shot.id} /> : null}
                <span className="area-ic" aria-hidden="true"><HomeIcon name={meta.icon} size={20} /></span>
                <h3>{area}</h3>
                <p>{meta.intro}</p>
                <span className="area-go">Vedi le funzioni{ARROW_ICON}</span>
              </Link>
            );
          })}
        </Reveal>
        <div className="cta" style={{ marginTop: 40 }}>
          <Link className="btn ghost" href={CONTENT_PATHS.funzioni}>Tutte le funzioni{ARROW_ICON}</Link>
          <Link className="btn ghost" href={CONTENT_PATHS.schermate}>Tutte le schermate{ARROW_ICON}</Link>
        </div>
      </div>
    </TrackedSection>
  );
}
