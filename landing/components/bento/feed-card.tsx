"use client";

import { useEffect, useState } from "react";
import { DEMO_MOVEMENTS } from "@/content/demo";

/** Ogni quanti ms arriva un nuovo movimento nel flusso d'esempio. */
const FEED_INTERVAL_MS = 2600;
/** Movimenti mostrati contemporaneamente. */
const FEED_VISIBLE = 4;

/** Flusso di movimenti d'esempio: il testo grezzo della banca diventa nome, categoria e gruppo. */
export function FeedCard() {
  const [count, setCount] = useState(FEED_VISIBLE);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      if (!document.hidden) setCount((c) => c + 1);
    }, FEED_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  const items = Array.from({ length: FEED_VISIBLE }, (_, k) => {
    const index = count - 1 - k;
    return { key: index, m: DEMO_MOVEMENTS[((index % DEMO_MOVEMENTS.length) + DEMO_MOVEMENTS.length) % DEMO_MOVEMENTS.length] };
  });

  return (
    <div className="vis feed" aria-hidden="true">
      {items.map(({ key, m }, k) => (
        <div className={`fi${k === 0 && count > FEED_VISIBLE ? " new" : ""}`} key={key}>
          <b>{m.name}</b>
          <span className="a" style={{ color: m.positive ? "var(--a-pos)" : "var(--a-fg)" }}>{m.amount} €</span>
          <small>
            {m.raw} · <span style={{ color: `var(${m.token})` }}>{m.category}</span>
          </small>
        </div>
      ))}
    </div>
  );
}
