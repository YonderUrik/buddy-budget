"use client";

import { useRef } from "react";
import "./story.css";
import { STORY_POINTS, STORY_TEXT } from "@/content/site";
import { gsap, MOTION_OK, useGSAP } from "@/lib/motion/gsap";
import { Reveal } from "./reveal";
import { TrackedSection } from "./tracked-section";

/** Frase che si accende parola per parola mentre scorri, seguita dalle tre risposte (cos'è, a cosa serve, cosa dà). */
export function Story() {
  const say = useRef<HTMLParagraphElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.to(".w", {
          opacity: 1,
          stagger: 0.5,
          ease: "none",
          scrollTrigger: { trigger: say.current, start: "top 78%", end: "bottom 45%", scrub: 0.6 },
        });
      });
      return () => mm.revert();
    },
    { scope: say },
  );

  return (
    <TrackedSection id="perche" section="perche" className="story">
      <div className="wrap">
        <div className="kicker">Perché esiste</div>
        <p className="say" ref={say} aria-label={STORY_TEXT}>
          {STORY_TEXT.split(/\s+/).map((word, i) => (
            <span className="w" key={i} aria-hidden="true">{word} </span>
          ))}
        </p>
        <Reveal className="trio" stagger distance={40}>
          {STORY_POINTS.map((p) => (
            <div key={p.kicker}>
              <div className="n">{p.kicker}</div>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </TrackedSection>
  );
}
