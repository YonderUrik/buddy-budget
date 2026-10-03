"use client";

import { useRef, useState } from "react";
import "./product-tour.css";
import { TOUR_STEPS } from "@/content/site";
import { track, type LandingEvents } from "@/lib/analytics";
import { groupThousands } from "@/lib/format";
import { EASE_OUT, gsap, MOTION_OK, ScrollTrigger, useGSAP } from "@/lib/motion/gsap";
import { TOUR_SCREEN_IDS } from "@/content/screens";
import { AppShot } from "./app-shot";
import { TrackedSection } from "./tracked-section";

/** Evento Umami per ciascun passo (stesso ordine di `TOUR_STEPS` e di `TOUR_SCREEN_IDS`). */
const TOUR_EVENTS: readonly LandingEvents["tour_step_viewed"]["step"][] = ["collega", "capisci", "investi", "prepara", "decidi"];

/** Durata del conteggio della cifra, in secondi. */
const FIGURE_COUNT_SECONDS = 1.4;

const UNIT_SUFFIX = { eur: " €", ore: " h" } as const;

/** Quanta parte dell'altezza del passo deve superare il centro dello schermo per attivarlo. */
const STEP_ACTIVATE_AT = "top 55%";
const STEP_DEACTIVATE_AT = "bottom 55%";

/**
 * Racconto in cinque passi: a sinistra il testo scorre, a destra la finestra dell'app resta ferma (sticky nativo)
 * e cambia schermata col passo attivo.
 */
export function ProductTour() {
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const seen = useRef(new Set<number>());

  useGSAP(
    () => {
      const steps = stepElements(root.current);
      const triggers = steps.map((el, i) =>
        ScrollTrigger.create({
          trigger: el,
          start: STEP_ACTIVATE_AT,
          end: STEP_DEACTIVATE_AT,
          onToggle: (self) => {
            if (!self.isActive) return;
            setActive(i);
            if (!seen.current.has(i)) {
              seen.current.add(i);
              track("tour_step_viewed", { step: TOUR_EVENTS[i] });
            }
          },
        }),
      );
      return () => triggers.forEach((t) => t.kill());
    },
    { scope: root },
  );

  // La cifra del passo attivo conta da zero fino al valore (senza movimento resta il valore finale scritto nell'HTML).
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const el = root.current?.querySelector<HTMLElement>(".tour-fig.on b");
        if (!el) return;
        const to = Number(el.dataset.to);
        const suffix = UNIT_SUFFIX[el.dataset.unit as keyof typeof UNIT_SUFFIX] ?? "";
        const state = { v: 0 };
        gsap.to(state, { v: to, duration: FIGURE_COUNT_SECONDS, ease: EASE_OUT, onUpdate: () => { el.textContent = groupThousands(Math.round(state.v)) + suffix; } });
      });
      return () => mm.revert();
    },
    { scope: root, dependencies: [active] },
  );

  return (
    <TrackedSection id="prodotto" section="prodotto" className="tour" navDark>
      <div className="wrap">
        <div className="kicker">Il prodotto</div>
        <h2 className="t">Dal movimento grezzo alla decisione.</h2>
        <p className="lede">Cinque passi, nello stesso quadro. Scorri e guarda l&apos;app.</p>
        <div className="tgrid" ref={root}>
          <div className="steps">
            {TOUR_STEPS.map((s, i) => (
              <div key={s.kicker} className={`step${i === active ? " on" : ""}`}>
                <div className="n">{s.kicker}</div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
                <ul>
                  {s.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="sticky">
            <div className="tour-shots">
              {TOUR_SCREEN_IDS.map((id, i) => (
                <AppShot key={id} id={id} className={`tour-shot${i === active ? " on" : ""}`} />
              ))}
              {TOUR_STEPS.map((s, i) =>
                s.figure ? (
                  <div key={s.kicker} className={`tour-fig${i === active ? " on" : ""}`} aria-hidden={i === active ? undefined : true}>
                    <span className="lab">{s.figure.label}</span>
                    <b className={s.figure.tone} data-to={s.figure.value} data-unit={s.figure.unit}>{groupThousands(s.figure.value)}{UNIT_SUFFIX[s.figure.unit]}</b>
                    <small>{s.figure.note}</small>
                  </div>
                ) : null,
              )}
            </div>
          </div>
        </div>
      </div>
    </TrackedSection>
  );
}

function stepElements(root: HTMLElement | null): HTMLElement[] {
  return root ? Array.from(root.querySelectorAll<HTMLElement>(".step")) : [];
}
