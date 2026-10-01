"use client";

import { useRef, type PointerEvent } from "react";
import "../bento.css";
import { Reveal } from "../reveal";
import { BudgetCard } from "./budget-card";
import { DebtCard } from "./debt-card";
import { FeedCard } from "./feed-card";
import { PrivacyCard } from "./privacy-card";
import { SimulatorCard } from "./simulator-card";

/** Riquadri con le funzioni più riconoscibili, ognuno con un esempio vivo. Il bagliore segue il cursore. */
export function Bento() {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const card = (e.target as Element).closest<HTMLElement>(".bc");
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${e.clientX - r.left}px`);
    card.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  return (
    <div className="bento" ref={ref} onPointerMove={onMove}>
      <Reveal as="article" className="bc s7">
        <div>
          <h3>Si collega alla tua banca. Il resto lo fa lui.</h3>
          <p>Il testo grezzo dell&apos;estratto diventa un nome, una categoria e un gruppo di spesa.</p>
        </div>
        <FeedCard />
      </Reveal>
      <Reveal as="article" className="bc s5">
        <div>
          <h3>Prima di vendere, guarda quanto paghi.</h3>
          <p>Nell&apos;app usa le tue operazioni vere. Qui una versione semplificata.</p>
        </div>
        <SimulatorCard />
      </Reveal>
      <Reveal as="article" className="bc s4">
        <div>
          <h3>Quattro gruppi, un budget.</h3>
          <p>Dovute, Volute, Te futuro e Saltuarie. Quello che resta è avanzo.</p>
        </div>
        <BudgetCard />
      </Reveal>
      <Reveal as="article" className="bc s4">
        <div>
          <h3>Mutui e finanziamenti, con i conti giusti.</h3>
          <p>Ammortamento, estinzione anticipata e TAEG calcolati per te.</p>
        </div>
        <DebtCard />
      </Reveal>
      <Reveal as="article" className="bc s4">
        <div>
          <h3>I tuoi dati restano tuoi.</h3>
          <p>Esporti tutto in ZIP. Se cancelli l&apos;account hai 30 giorni per ripensarci.</p>
        </div>
        <PrivacyCard />
      </Reveal>
    </div>
  );
}
