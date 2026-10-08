"use client";

import { useRef, useState } from "react";
import "./screen-gallery.css";
import { SCREENS, type ScreenId } from "@/content/screens";
import { track } from "@/lib/analytics";
import { EASE_OUT, gsap, MOTION_OK, useGSAP } from "@/lib/motion/gsap";
import { AppShot } from "./app-shot";
import { TrackedSection } from "./tracked-section";

/** Ordine e titoli dei gruppi, come la sidebar dell'app. */
const AREAS = ["Panoramica", "Liquidità", "Investimenti", "Pensione", "Debiti", "Analitiche"] as const;

/**
 * Galleria di tutte le schermate dell'app: sono screenshot veri (vedi `docs/landing-screens.md`), non disegni.
 * Si sceglie la schermata dalle schede raggruppate per area; la sua didascalia dice cosa mostra.
 */
export function ScreenGallery() {
  const [selected, setSelected] = useState<ScreenId>("panoramica");
  const current = SCREENS.find((s) => s.id === selected) ?? SCREENS[0];
  const view = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  // Cambio di schermata: la nuova si svela dall'alto con un leggero zoom (non al primo render).
  useGSAP(
    () => {
      if (first.current) {
        first.current = false;
        return;
      }
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.fromTo(".shot", { clipPath: "inset(0 0 100% 0 round 14px)", scale: 1.03 }, { clipPath: "inset(0 0 0% 0 round 14px)", scale: 1, duration: 0.9, ease: EASE_OUT, clearProps: "clipPath,scale" });
        gsap.fromTo(".gal-cap", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.7, ease: EASE_OUT, delay: 0.15 });
      });
    },
    { scope: view, dependencies: [selected] },
  );

  const select = (id: ScreenId) => {
    if (id === selected) return;
    setSelected(id);
    track("screen_selected", { screen: id });
  };

  return (
    <TrackedSection id="schermate" section="schermate" className="gal">
      <div className="gal-grid">
        <nav className="gal-nav" aria-label="Schermate dell'app">
          {AREAS.map((area) => (
            <div key={area} className="gal-area">
              <div className="gal-area-t">{area}</div>
              {SCREENS.filter((s) => s.area === area).map((s) => (
                <button key={s.id} type="button" className="gal-tab" aria-pressed={s.id === selected} onClick={() => select(s.id)}>
                  {s.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="gal-view" ref={view}>
          <AppShot id={current.id} />
          <p className="gal-cap" aria-live="polite">{current.caption}</p>
        </div>
      </div>
    </TrackedSection>
  );
}
