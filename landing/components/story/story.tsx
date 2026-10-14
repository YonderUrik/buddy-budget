"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "./story.css";
import { STEPS } from "@/content/story";
import { track } from "@/lib/analytics";
import { useSectionView } from "@/lib/use-section-view";
import { StoryHero } from "./story-hero";
import { StoryStage } from "./story-stage";
import { StoryStep } from "./story-step";
import { VIEWS, type ActiveId } from "./story-views";

/** Sotto questa larghezza (px) la finestra diventa un telefono fissato in alto (allineata a `story.css`). */
const STORY_MOBILE_BREAKPOINT = 1000;
/** Quota dell'altezza della finestra oltre la quale un passo diventa quello in vista: più in basso sul telefono, dove sopra c'è il telefono. */
const PICK_LINE_DESKTOP = 0.5;
const PICK_LINE_PHONE = 0.62;
/** Sul telefono la linea sta comunque sotto il telefono fissato, di almeno questo (px): un passo raggiunto da un link è subito quello in vista. */
const PICK_BELOW_STAGE = 24;

/**
 * La home «Sei domande»: a sinistra l'apertura e i sei passi scorrono, a destra la finestra dell'app resta ferma e
 * risponde. Il passo in vista è l'ultimo il cui bordo superiore ha superato la linea di metà schermo.
 */
export function Story() {
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState<ActiveId>("hero");
  const [real, setReal] = useState(false);
  const seen = useRef(new Set<ActiveId>());
  useSectionView(ref, "storia");

  const stageHeight = useRef(0);

  const pick = useCallback(() => {
    const root = ref.current;
    if (!root) return;
    const mobile = window.innerWidth <= STORY_MOBILE_BREAKPOINT;
    let line = window.innerHeight * (mobile ? PICK_LINE_PHONE : PICK_LINE_DESKTOP);
    if (mobile) {
      // L'altezza del telefono fissato decide dove atterra un passo raggiunto da un link (`--stage-h`) e dove passa la linea.
      const h = root.querySelector<HTMLElement>(".stage-col")?.offsetHeight ?? 0;
      if (h !== stageHeight.current) {
        stageHeight.current = h;
        root.style.setProperty("--stage-h", `${h}px`);
      }
      line = Math.max(line, h + PICK_BELOW_STAGE);
    }
    let found: ActiveId = "hero";
    root.querySelectorAll<HTMLElement>("[data-step]").forEach((el) => {
      if (el.getBoundingClientRect().top <= line) found = el.dataset.step as ActiveId;
    });
    setActive(found);
  }, []);

  useEffect(() => {
    pick();
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        pick();
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [pick]);

  // Un evento per passo, la prima volta che entra in vista: dice fin dove arriva chi legge.
  useEffect(() => {
    if (active === "hero" || seen.current.has(active)) return;
    seen.current.add(active);
    track("story_step_viewed", { step: active });
  }, [active]);

  const toggleReal = () => {
    const next = !real;
    setReal(next);
    if (active !== "hero") track("story_real_toggled", { step: active, real: next });
  };

  return (
    <section id="storia" ref={ref} className="story">
      <div className="wrap story-grid">
        <StoryHero on={active === "hero"} />
        <StoryStage active={active} view={VIEWS[active]} real={real} onToggleReal={toggleReal} />
        {STEPS.map((step) => <StoryStep key={step.id} step={step} on={active === step.id} />)}
      </div>
    </section>
  );
}
