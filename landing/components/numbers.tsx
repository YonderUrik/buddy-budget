"use client";

import { useRef } from "react";
import "./numbers.css";
import { featureCounts } from "@/content/catalog.generated";
import { SCREENS } from "@/content/screens";
import { EASE_OUT, gsap, MOTION_OK, useGSAP } from "@/lib/motion/gsap";
import { groupThousands } from "@/lib/format";

/** Gruppi di spesa dell'app (Dovute, Volute, Te futuro, Saltuarie). */
const SPEND_GROUPS = 4;

/** Durata del conteggio, in secondi. */
const COUNT_SECONDS = 1.8;

/** Fascia di numeri veri del prodotto (dal catalogo e dalle schermate), che contano fino al valore quando entra in vista. */
export function Numbers() {
  const root = useRef<HTMLDivElement>(null);
  const { total, available } = featureCounts();
  const items = [
    { value: available, label: "funzioni già disponibili" },
    { value: total - available, label: "in arrivo" },
    { value: SCREENS.length, label: "schermate, tutte fotografate dall'app" },
    { value: SPEND_GROUPS, label: "gruppi di spesa, un solo budget" },
  ];

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        root.current?.querySelectorAll<HTMLElement>("[data-to]").forEach((el) => {
          const state = { v: 0 };
          gsap.to(state, {
            v: Number(el.dataset.to),
            duration: COUNT_SECONDS,
            ease: EASE_OUT,
            onUpdate: () => {
              el.textContent = groupThousands(Math.round(state.v));
            },
            scrollTrigger: { trigger: el, start: "top 90%", once: true },
          });
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <div className="numbers" ref={root}>
      <div className="wrap">
        <dl>
          {items.map((item) => (
            <div key={item.label}>
              <dt data-to={item.value}>{groupThousands(item.value)}</dt>
              <dd>{item.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
