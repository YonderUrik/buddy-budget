import "./feature-areas.css";
import Link from "next/link";
import { FEATURE_AREAS, featuresByArea, featureText, type Feature, type FeatureStatus } from "@/content/catalog.generated";
import { areaMeta } from "@/content/feature-areas";
import { countByRules, FEATURE_NEEDS } from "@/content/rules-needs";
import type { Locale } from "@/lib/i18n";
import { needsAttr } from "@/lib/visitor-country";
import { ByRulesText } from "./by-rules";
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

/** Features shown to the visitor, per rules variant: features on rules their country lacks are hidden. */
export function featureCountByRules(features: readonly Feature[]) {
  return countByRules(features, (f) => FEATURE_NEEDS[f.id]);
}

/**
 * Every feature, area by area, from the shared catalog. Each area has its icon, a sentence, the real app screen and
 * the features as cards. All the text is in the HTML (no tabs to open): search engines read it too. Features on rules
 * the visitor's country lacks (`FEATURE_NEEDS`) are hidden, and the counts follow.
 */
export function FeatureAreas({ locale = "it" }: { locale?: Locale }) {
  const metas = areaMeta(locale);
  const status = STATUS_LABEL[locale];
  return (
    <>
      <AreaJump label={JUMP_LABEL[locale]} areas={FEATURE_AREAS.map((a) => ({ area: a, name: metas[a].name, slug: metas[a].slug, count: featureCountByRules(featuresByArea(a)) }))} />
      {FEATURE_AREAS.map((area) => {
        const meta = metas[area];
        const features = featuresByArea(area);
        return (
          <section key={area} id={meta.slug} className="fa" aria-labelledby={`${meta.slug}-t`}>
            <div className={`fa-head${meta.shot ? "" : " no-shot"}`}>
              <div>
                <h2 id={`${meta.slug}-t`}>{meta.name} <small><ByRulesText text={featureCountByRules(features)} /></small></h2>
                <p><ByRulesText text={meta.intro} /></p>
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
                  <article key={f.id} className="fa-card" data-needs={needsAttr(FEATURE_NEEDS[f.id])}>
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
