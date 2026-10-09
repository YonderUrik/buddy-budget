"use client";

import { useRef } from "react";
import "./steps.css";
import { STEPS } from "@/content/home";
import { EASE_OUT, gsap, MOTION_OK, useGSAP } from "@/lib/motion/gsap";
import { HomeIcon } from "./home-icon";
import { ToolShot } from "./tool-shot";
import { TrackedSection } from "./tracked-section";

/**
 * "Si parte in tre passi": collega o importa, vedi il quadro, decidi. Ogni passo ha la schermata vera, senza la barra laterale.
 * La linea che unisce i numeri si disegna scorrendo; i passi entrano in sequenza.
 */
export function Steps({ content = STEPS }: { content?: typeof STEPS }) {
  const ref = useRef<HTMLOListElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.from(el.querySelectorAll(":scope > li"), { opacity: 0, y: 40, duration: 1, ease: EASE_OUT, stagger: 0.14, scrollTrigger: { trigger: el, start: "top 82%", once: true } });
        gsap.fromTo(el.querySelector(".steps-line"), { scaleX: 0 }, { scaleX: 1, ease: "none", scrollTrigger: { trigger: el, start: "top 80%", end: "bottom 60%", scrub: 0.5 } });
      });
      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <TrackedSection id="passi" section="passi" className="sec steps">
      <div className="wrap">
        <h2 className="t">{content.title}</h2>
        <p className="lede">{content.lede}</p>
        <ol ref={ref} className="steps-list">
          <span className="steps-line" aria-hidden="true" />
          {content.steps.map((s, i) => (
            <li key={s.title}>
              <span className="steps-n" aria-hidden="true">
                <HomeIcon name={s.icon} size={18} />
              </span>
              <span className="steps-k">Passo {i + 1}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
              <ToolShot id={s.shot.id} />
            </li>
          ))}
        </ol>
      </div>
    </TrackedSection>
  );
}
