import "./feature-areas.css";
import Link from "next/link";
import { FEATURE_AREAS, featuresByArea, featureText, type FeatureStatus } from "@/content/catalog.generated";
import { areaMeta } from "@/content/feature-areas";
import type { Locale } from "@/lib/i18n";
import { AreaJump } from "./area-jump";
import { Reveal } from "./reveal";
import { AppShot } from "./app-shot";

/** A label only for what is not yet "normal": a feature available for a while needs no badge. */
const STATUS_LABEL: Record<Locale, Partial<Record<FeatureStatus, string>>> = {
  it: { new: "Nuovo", soon: "In arrivo" },
  en: { new: "New", soon: "Coming soon" },
};

/** `aria-label` of the row of shortcuts to the areas. */
const JUMP_LABEL: Record<Locale, string> = { it: "Aree", en: "Areas" };

/**
 * Tutte le funzioni, area per area, dal catalogo condiviso. Ogni area ha la sua icona, una frase, la schermata vera dell'app
 * e le funzioni in schede. Tutto il testo è nell'HTML (niente schede da aprire): serve anche ai motori di ricerca.
 */
export function FeatureAreas({ locale = "it" }: { locale?: Locale }) {
  const metas = areaMeta(locale);
  const status = STATUS_LABEL[locale];
  return (
    <>
      <AreaJump label={JUMP_LABEL[locale]} areas={FEATURE_AREAS.map((a) => ({ area: a, name: metas[a].name, slug: metas[a].slug, count: featuresByArea(a).length }))} />
      {FEATURE_AREAS.map((area) => {
        const meta = metas[area];
        const features = featuresByArea(area);
        return (
          <section key={area} id={meta.slug} className="fa" aria-labelledby={`${meta.slug}-t`}>
            <div className={`fa-head${meta.shot ? "" : " no-shot"}`}>
              <div>
                <h2 id={`${meta.slug}-t`}>{meta.name} <small>{features.length}</small></h2>
                <p>{meta.intro}</p>
                {meta.more ? (
                  <Link className="fa-more" href={meta.more.href}>
                    {meta.more.label} <em aria-hidden="true">→</em>
                  </Link>
                ) : null}
              </div>
              {meta.shot ? <AppShot id={meta.shot.id} locale={locale} className="fa-shot" /> : null}
            </div>
            <Reveal stagger className="fa-grid">
              {features.map((f) => {
                const text = featureText(f, locale);
                return (
                  <article key={f.id} className="fa-card">
                    <h3>
                      {text.name}
                      {status[f.status] ? <span className={`fa-tag ${f.status}`}>{status[f.status]}</span> : null}
                    </h3>
                    <p>{text.description}</p>
                  </article>
                );
              })}
            </Reveal>
          </section>
        );
      })}
    </>
  );
}
