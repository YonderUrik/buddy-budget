"use client";

import { useState } from "react";
import "./feature-catalog.css";
import { FEATURE_AREAS, featuresByArea, type FeatureArea, type FeatureStatus } from "@/content/features";
import { track } from "@/lib/analytics";

const STATUS_LABEL: Record<FeatureStatus, string> = { live: "Disponibile", new: "Nuovo", soon: "Presto" };
/** Ritardo (ms) tra una riga e la successiva all'ingresso. */
const ROW_STAGGER_MS = 45;

/** Catalogo delle funzioni per area, generato da `content/features.ts`. */
export function FeatureCatalog() {
  const [area, setArea] = useState<FeatureArea>(FEATURE_AREAS[0]);
  const rows = featuresByArea(area);

  return (
    <div className="cat">
      <div className="areas" role="group" aria-label="Aree">
        {FEATURE_AREAS.map((a) => (
          <button
            key={a}
            type="button"
            aria-pressed={a === area}
            onClick={() => {
              setArea(a);
              track("catalog_area_selected", { area: a });
            }}
          >
            {a}
            <small>{featuresByArea(a).length}</small>
          </button>
        ))}
      </div>
      <div className="flist" aria-live="polite">
        {rows.map((f, i) => (
          <div className="fr" key={`${area}-${f.title}`} style={{ animationDelay: `${i * ROW_STAGGER_MS}ms` }}>
            <h4>{f.title}</h4>
            <p>{f.description}</p>
            <span className={`tag ${f.status}`}>{STATUS_LABEL[f.status]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
