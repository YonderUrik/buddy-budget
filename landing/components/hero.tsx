"use client";

import { groupThousands } from "@/lib/format";
import { useRef } from "react";
import "./hero.css";
import { APP_LINKS } from "@/content/site";
import { track } from "@/lib/analytics";
import { useSectionView } from "@/lib/use-section-view";
import { EASE_OUT, gsap, MOTION_OK, useGSAP } from "@/lib/motion/gsap";
import { AppWindow } from "./app-window";
import { ARROW_ICON, CtaLink } from "./cta-link";
import { PanoramicaScreen } from "./screens";

/** Totale d'esempio del patrimonio netto che si anima nella finestra dell'hero. */
const HERO_NET_WORTH = 47320;

/**
 * Apertura: il titolo entra riga per riga, poi sale la finestra dell'app con il patrimonio che conta fino al totale.
 * Scrollando, la finestra si raddrizza e cresce (trasformazioni GPU, nessun layout).
 */
export function Hero() {
  const root = useRef<HTMLElement>(null);
  useSectionView(root, "hero");
  const stage = useRef<HTMLDivElement>(null);
  const tilt = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const count = root.current?.querySelector<HTMLElement>("[data-count]");
        const counter = { v: 0 };
        gsap
          .timeline({ defaults: { ease: EASE_OUT } })
          .fromTo("h1 .ln > span", { yPercent: 112, y: 0 }, { yPercent: 0, y: 0, duration: 1.4, stagger: 0.14, delay: 0.1 })
          .fromTo(".hrow > *", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1, stagger: 0.1 }, "-=1")
          .fromTo(tilt.current, { opacity: 0, y: 90 }, { opacity: 1, y: 0, duration: 1.6 }, "-=0.9")
          .to(
            counter,
            {
              v: HERO_NET_WORTH,
              duration: 2,
              ease: "power3.out",
              onUpdate: () => {
                if (count) count.textContent = groupThousands(counter.v);
              },
            },
            "-=1.1",
          );
        gsap.fromTo(
          tilt.current,
          { rotateX: 12, scale: 0.93 },
          { rotateX: 0, scale: 1, ease: "none", scrollTrigger: { trigger: stage.current, start: "top 85%", end: "top 18%", scrub: 0.8 } },
        );
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section id="top" className="hero" ref={root}>
      <div>
        <div className="wrap">
          <h1 aria-label="Quanto vali, davvero?">
            <span className="ln"><span>Quanto <em>vali</em>,</span></span>
            <span className="ln"><span>davvero?</span></span>
          </h1>
          <div className="hrow">
            <p>BuddyBudget mette conti, spese, investimenti e debiti in un solo quadro, con le tasse italiane già dentro.</p>
            <div className="cta">
              <CtaLink className="btn main" href={APP_LINKS.signup} location="hero" target="signup">
                Crea il tuo account{ARROW_ICON}
              </CtaLink>
              <a className="btn ghost" href="#prodotto" onClick={() => track("cta_click", { location: "hero", target: "how_it_works" })}>
                Guarda come funziona
              </a>
            </div>
          </div>
        </div>
        <div className="stage" ref={stage}>
          <div className="wrap">
            <div className="inner">
              <div className="tilt" ref={tilt}>
                <AppWindow active="pano" url="app.buddybudget.io/panoramica">
                  <PanoramicaScreen />
                </AppWindow>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
