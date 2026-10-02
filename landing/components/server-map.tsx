"use client";

import { useRef } from "react";
import "./server-map.css";
import { EUROPE_MAP } from "@/content/europe-map";
import { EASE_OUT, gsap, MOTION_OK, useGSAP } from "@/lib/motion/gsap";

/** Durata del tratto di connessione cifrata, in secondi. */
const LINK_SECONDS = 1.6;

/** Bandiera della Germania in SVG (niente emoji: sui sistemi senza font colorato apparirebbe come "DE"). */
export function GermanFlag({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 5 3" role="img" aria-label="Bandiera della Germania">
      <rect width="5" height="1" fill="#000" />
      <rect y="1" width="5" height="1" fill="#dd0000" />
      <rect y="2" width="5" height="1" fill="#ffce00" />
    </svg>
  );
}

/**
 * Europa con la Germania in evidenza e il punto del server. Quando entra in vista i paesi compaiono, la Germania si accende
 * e una linea tratteggiata cifrata collega un utente (Italia) al server. Con `prefers-reduced-motion` resta ferma e completa.
 */
export function ServerMap() {
  const root = useRef<HTMLDivElement>(null);
  const { width, height, others, germany, server, user } = EUROPE_MAP;
  const link = `M${user.x} ${user.y} Q${(user.x + server.x) / 2 + 70} ${(user.y + server.y) / 2} ${server.x} ${server.y}`;

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 80%", once: true } });
        tl.from(el.querySelector(".sm-land"), { opacity: 0, duration: 0.9, ease: "power2.out" })
          .from(el.querySelector(".sm-de"), { opacity: 0, duration: 0.7, ease: "power2.out" }, "-=0.3")
          .from(el.querySelector(".sm-user"), { scale: 0, transformOrigin: "50% 50%", duration: 0.5, ease: "back.out(2)" }, "-=0.2")
          .from(el.querySelector(".sm-link"), { strokeDashoffset: 1, duration: LINK_SECONDS, ease: "power2.inOut" })
          .from(el.querySelector(".sm-pin"), { scale: 0, transformOrigin: "50% 50%", duration: 0.6, ease: EASE_OUT })
          .from(el.querySelectorAll(".sm-badge"), { opacity: 0, y: 14, duration: 0.7, stagger: 0.15, ease: EASE_OUT }, "-=0.4");
        el.classList.add("sm-live");
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <div className="sm" ref={root}>
      <svg className="sm-map" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Mappa dell'Europa: il server di BuddyBudget è in Germania">
        <path className="sm-land" d={others} />
        <path className="sm-de" d={germany} />
        <path className="sm-link" d={link} pathLength={1} />
        <circle className="sm-user" cx={user.x} cy={user.y} r={6} />
        <g className="sm-pin" transform={`translate(${server.x} ${server.y})`}>
          <circle className="sm-ring" r={10} />
          <circle className="sm-ring r2" r={10} />
          <circle className="sm-dot" r={7} />
        </g>
      </svg>
      <div className="sm-badge sm-badge-de">
        <GermanFlag className="sm-flag" />
        <span>
          <strong>Server in Germania</strong>
          <small>Dati nell&apos;Unione Europea</small>
        </span>
      </div>
      <div className="sm-badge sm-badge-link">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="sm-lock">
          <path d="M7 10V8a5 5 0 0 1 10 0v2h1.5A1.5 1.5 0 0 1 20 11.5v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5v-8A1.5 1.5 0 0 1 5.5 10H7Zm2 0h6V8a3 3 0 0 0-6 0v2Z" fill="currentColor" />
        </svg>
        <span>
          <strong>Connessione cifrata</strong>
          <small>Dal tuo dispositivo al server</small>
        </span>
      </div>
    </div>
  );
}
