"use client";

import "./details.css";
import { useState } from "react";
import { DETAILS, type DetailId } from "@/content/sheet";
import { track } from "@/lib/analytics";
import { ShotCrop } from "./shot-crop";
import { TrackedSection } from "./tracked-section";

/**
 * «Nel dettaglio»: una scheda per area (banca, categorie, broker, rischio, tasse, debiti e pensione, limiti) con la
 * schermata e una scheda tecnica breve. Tutte le schede sono nell'HTML (indicizzabili); si vede solo quella scelta.
 * Invia `detail_tab_selected`.
 */
export function Details({ content = DETAILS }: { content?: typeof DETAILS }) {
  const [active, setActive] = useState<DetailId>(content.tabs[0].id);
  const choose = (id: DetailId) => {
    setActive(id);
    track("detail_tab_selected", { tab: id });
  };

  return (
    <TrackedSection id="dettagli" section="dettagli" className="sec dt">
      <div className="wrap">
        <span className="ref">{content.ref}</span>
        <h2 className="t">{content.title}</h2>
        <p className="lede">{content.lede}</p>
        <div className="dt-grid">
          <div className="dt-tabs" role="tablist" aria-label="Argomenti">
            {content.tabs.map((t) => (
              <button key={t.id} id={`dt-tab-${t.id}`} type="button" role="tab" aria-selected={active === t.id} aria-controls={`dt-panel-${t.id}`} onClick={() => choose(t.id)}>
                {t.tab}
              </button>
            ))}
          </div>
          {content.tabs.map((t) => (
            <div key={t.id} id={`dt-panel-${t.id}`} role="tabpanel" aria-labelledby={`dt-tab-${t.id}`} className="dt-panel cell" hidden={active !== t.id}>
              <div className="dt-head">
                <h3>{t.title}</h3>
                <p>{t.lede}</p>
              </div>
              <div className={`dt-body${"shot" in t && t.shot ? "" : " noshot"}`}>
                <dl>
                  {t.specs.map(([label, text]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{text}</dd>
                    </div>
                  ))}
                </dl>
                {"shot" in t && t.shot ? <ShotCrop id={t.shot} className="dt-shot" /> : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </TrackedSection>
  );
}
