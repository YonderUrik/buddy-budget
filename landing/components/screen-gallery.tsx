"use client";

import { useRef, useState } from "react";
import "./screen-gallery.css";
import { SCREENS, type ScreenId } from "@/content/screens";
import { track } from "@/lib/analytics";
import { EASE_OUT, gsap, MOTION_OK, useGSAP } from "@/lib/motion/gsap";
import { AppShot } from "./app-shot";
import { PhoneShot } from "./phone-shot";
import { TrackedSection } from "./tracked-section";

/** Ordine e titoli dei gruppi, come la sidebar dell'app. */
const AREAS = ["Panoramica", "Liquidità", "Investimenti", "Pensione", "Debiti", "Analitiche"] as const;

export interface ScreenGalleryProps {
  /** On the phone, shows the phone-size version inside the phone frame (for the screens that have one) instead of the shrunken full screenshot. */
  phoneOnMobile?: boolean;
}

/**
 * Galleria di tutte le schermate dell'app: sono screenshot veri (vedi `docs/landing-screens.md`), non disegni, sempre
 * interi. Si sceglie la schermata dalle schede raggruppate per area, sopra l'immagine; la didascalia dice cosa mostra.
 */
export function ScreenGallery({ phoneOnMobile = false }: ScreenGalleryProps) {
  const [selected, setSelected] = useState<ScreenId>("panoramica");
  const current = SCREENS.find((s) => s.id === selected) ?? SCREENS[0];
  const hasPhone = phoneOnMobile && "phone" in current && current.phone;
  const view = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  // Screen change: the new one is revealed from the top with a slight zoom (not on first render); the phone fades in.
  useGSAP(
    () => {
      if (first.current) {
        first.current = false;
        return;
      }
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.fromTo(".shot", { clipPath: "inset(0 0 100% 0 round 16px)", scale: 1.02 }, { clipPath: "inset(0 0 0% 0 round 16px)", scale: 1, duration: 0.35, ease: EASE_OUT, clearProps: "clipPath,scale" });
        gsap.fromTo(".pf, .gal-cap", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.3, ease: EASE_OUT, delay: 0.05, clearProps: "opacity,transform" });
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
    <TrackedSection id="schermate" section="schermate" className={`gal${phoneOnMobile ? " gal-pm" : ""}`}>
      <nav className="gal-nav" aria-label="Schermate dell'app">
        {AREAS.map((area) => (
          <div key={area} className="gal-area" role="group" aria-label={area}>
            <span className="gal-area-t">{area}</span>
            <div className="gal-area-b">
              {SCREENS.filter((s) => s.area === area).map((s) => (
                <button key={s.id} type="button" className="gal-tab" aria-pressed={s.id === selected} onClick={() => select(s.id)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="gal-view" ref={view}>
        <p className="gal-cap" aria-live="polite"><b>{current.label}</b>{current.caption}</p>
        <AppShot id={current.id} className={hasPhone ? "gal-desk" : undefined} />
        {hasPhone ? <PhoneShot id={current.id} className="gal-phone" /> : null}
      </div>
    </TrackedSection>
  );
}
