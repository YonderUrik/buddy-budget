import "./feature-areas.css";
import Link from "next/link";
import { FEATURE_AREAS, featuresByArea, type FeatureStatus } from "@/content/catalog.generated";
import { AREA_META } from "@/content/feature-areas";
import { AreaJump } from "./area-jump";
import { HomeIcon } from "./home-icon";
import { Reveal } from "./reveal";
import { ToolShot } from "./tool-shot";

/** Etichetta solo per ciò che non è ancora «normale»: una funzione disponibile da tempo non ha bisogno di bollino. */
const STATUS_LABEL: Partial<Record<FeatureStatus, string>> = { new: "Nuovo", soon: "In arrivo" };

/**
 * Tutte le funzioni, area per area, dal catalogo condiviso. Ogni area ha la sua icona, una frase, la schermata vera dell'app
 * e le funzioni in schede. Tutto il testo è nell'HTML (niente schede da aprire): serve anche ai motori di ricerca.
 */
export function FeatureAreas() {
  return (
    <>
      <AreaJump areas={FEATURE_AREAS.map((a) => ({ area: a, slug: AREA_META[a].slug, count: featuresByArea(a).length }))} />
      {FEATURE_AREAS.map((area) => {
        const meta = AREA_META[area];
        const features = featuresByArea(area);
        return (
          <section key={area} id={meta.slug} className="fa" aria-labelledby={`${meta.slug}-t`}>
            <div className={`fa-head${meta.shot ? "" : " no-shot"}`}>
              <div>
                <span className="fa-ic" aria-hidden="true"><HomeIcon name={meta.icon} size={20} /></span>
                <h2 id={`${meta.slug}-t`}>{area} <small>{features.length}</small></h2>
                <p>{meta.intro}</p>
                {meta.more ? (
                  <Link className="fa-more" href={meta.more.href}>
                    {meta.more.label} <em aria-hidden="true">→</em>
                  </Link>
                ) : null}
              </div>
              {meta.shot ? <ToolShot id={meta.shot.id} /> : null}
            </div>
            <Reveal stagger className="fa-grid">
              {features.map((f) => (
                <article key={f.id} className="fa-card">
                  <h3>
                    {f.name}
                    {STATUS_LABEL[f.status] ? <span className={`fa-tag ${f.status}`}>{STATUS_LABEL[f.status]}</span> : null}
                  </h3>
                  <p>{f.description}</p>
                </article>
              ))}
            </Reveal>
          </section>
        );
      })}
    </>
  );
}
