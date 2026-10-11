"use client";

import "./tour.css";
import Link from "next/link";
import { useState } from "react";
import { CONTENT_PATHS } from "@/content/seo-pages";
import { TOUR, type TourId } from "@/content/sheet";
import { track } from "@/lib/analytics";
import { AppShot } from "./app-shot";
import { HomeIcon } from "./home-icon";
import { TrackedSection } from "./tracked-section";

/**
 * «L'app, area per area»: una scheda per area con il foglio di prima, cosa fa l'app, la schermata intera (mai ritagliata)
 * e la scheda tecnica. Tutte le schede sono nell'HTML (indicizzabili); si vede solo quella scelta. Invia `tour_tab_selected`.
 */
export function Tour({ content = TOUR }: { content?: typeof TOUR }) {
  const [active, setActive] = useState<TourId>(content.tabs[0].id);
  const choose = (id: TourId) => {
    setActive(id);
    track("tour_tab_selected", { tab: id });
  };

  return (
    <TrackedSection id="app" section="app" className="sec tour">
      <div className="wrap">
        <span className="ref">{content.kicker}</span>
        <h2 className="t">{content.title}</h2>
        <p className="lede">{content.lede}</p>
        <div className="tour-tabs" role="tablist" aria-label="Aree dell'app">
          {content.tabs.map((t) => (
            <button key={t.id} id={`tour-tab-${t.id}`} type="button" role="tab" aria-selected={active === t.id} aria-controls={`tour-panel-${t.id}`} onClick={() => choose(t.id)}>
              <HomeIcon name={t.icon} size={16} />
              {t.tab}
            </button>
          ))}
        </div>
        {content.tabs.map((t) => (
          <div key={t.id} id={`tour-panel-${t.id}`} role="tabpanel" aria-labelledby={`tour-tab-${t.id}`} className="tour-panel" hidden={active !== t.id}>
            <h3>{t.title}</h3>
            <div className={`tour-story${"before" in t ? "" : " solo"}`}>
              {"before" in t && t.before ? (
                <div className="tour-before cell">
                  <span className="tour-lab">Nel foglio</span>
                  <code>{t.before.formula}</code>
                  <p>{t.before.text}</p>
                  <span className="tour-cost">{t.before.cost}</span>
                </div>
              ) : null}
              <div className="tour-after cell">
                <span className="tour-lab tour-now">Con BuddyBudget</span>
                <p>
                  {t.after.lead}
                  {"strong" in t.after && t.after.strong ? <> <strong>{t.after.strong}</strong></> : null}
                  {"tail" in t.after && t.after.tail ? ` ${t.after.tail}` : null}
                </p>
              </div>
            </div>
            {"shot" in t && t.shot ? <AppShot id={t.shot} className="tour-shot" /> : null}
            <dl className="tour-specs">
              {t.specs.map(([label, text]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{text}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
        <p className="tour-more">
          <Link href={CONTENT_PATHS.funzioni}>Tutte le funzioni, area per area →</Link>
          <Link href={CONTENT_PATHS.schermate}>Altre schermate →</Link>
        </p>
      </div>
    </TrackedSection>
  );
}
