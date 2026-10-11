"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import "./groups.css";
import { GROUPS } from "@/content/home";
import { groupThousands } from "@/lib/format";
import { TrackedSection } from "./tracked-section";

/** Quota della barra visibile oltre la quale i segmenti si riempiono. */
const BAR_VISIBLE_RATIO = 0.6;

/**
 * "Quattro gruppi": un mese di esempio come registro, una riga per gruppo (Dovute, Volute, Te futuro, Saltuarie, Avanzo) con la
 * sua barra in proporzione alle entrate. Le barre si riempiono una dopo l'altra quando il registro entra in vista.
 */
export function Groups({ content = GROUPS }: { content?: typeof GROUPS }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.classList.add("live");
          observer.disconnect();
        }
      },
      { threshold: BAR_VISIBLE_RATIO },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const label = content.groups.map((g) => `${g.name} ${groupThousands(g.amount)} €`).join(", ");
  return (
    <TrackedSection id="gruppi" section="gruppi" className="sec groups band">
      <div className="wrap">
        <span className="kicker">{content.kicker}</span>
        <h2 className="t" style={{ marginTop: 14 }}>{content.title}</h2>
        <p className="lede">{content.lede}</p>
        <div ref={ref} className="grp">
          <div className="grp-head">
            <span>{content.incomeLabel}</span>
            <b>{groupThousands(content.income)} €</b>
          </div>
          <ul className="grp-rows" aria-label={label}>
            {content.groups.map((g, i) => (
              <li key={g.id} style={{ "--i": i } as CSSProperties}>
                <span className="grp-name"><i className={`g-${g.id}`} />{g.name}</span>
                <p>{g.text}</p>
                <span className="grp-track" aria-hidden="true">
                  <span className={`grp-seg g-${g.id}`} style={{ "--w": `${(g.amount / content.income) * 100}%` } as CSSProperties} />
                </span>
                <b>{groupThousands(g.amount)} €</b>
                <span className="grp-pct">{Math.round((g.amount / content.income) * 100)}%</span>
              </li>
            ))}
          </ul>
          <p className="grp-note">{content.note}</p>
        </div>
      </div>
    </TrackedSection>
  );
}
