"use client";

import { useRef, type PointerEvent } from "react";
import "../bento.css";
import { Reveal } from "../reveal";
import { PrivacyCard } from "./privacy-card";
import { ShotCrop } from "./shot-crop";
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
          <h3>Dalla banca al budget, senza toccare nulla.</h3>
          <p>Il testo grezzo dell&apos;estratto diventa un nome pulito, una categoria e un gruppo di spesa.</p>
        </div>
        <ShotCrop id="movimenti" position="100% 30%" zoom={1.3} />
      </Reveal>
      <Reveal as="article" className="bc s5">
        <div>
          <h3>Prima di vendere, guarda quanto paghi.</h3>
          <p>Qui è una versione semplificata: nell&apos;app il calcolo parte dalle tue operazioni vere.</p>
        </div>
        <SimulatorCard />
      </Reveal>
      <Reveal as="article" className="bc s4">
        <div>
          <h3>Quattro gruppi, un solo budget.</h3>
          <p>Dovute, Volute, Te futuro e Saltuarie. Quello che resta è avanzo.</p>
        </div>
        <ShotCrop id="categorie" position="40% 20%" zoom={2.3} />
      </Reveal>
      <Reveal as="article" className="bc s4">
        <div>
          <h3>Mutui e finanziamenti, con i conti giusti.</h3>
          <p>Piano delle rate, TAEG ed estinzione anticipata, con la penale già dentro.</p>
        </div>
        <ShotCrop id="debiti" position="100% 20%" zoom={2.2} />
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
