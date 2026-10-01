"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";

/** Mostra la funzione "Nascondi importi": il pulsante sfoca le cifre della card. */
export function PrivacyCard() {
  const [hidden, setHidden] = useState(false);

  return (
    <div className={`vis${hidden ? " hide" : ""}`}>
      <div className="between">
        <div>
          <div className="lab">Patrimonio netto</div>
          <div className="mini amts">47.320 €</div>
        </div>
        <button
          className="eye"
          type="button"
          aria-pressed={hidden}
          onClick={() => {
            setHidden(!hidden);
            track("hide_amounts_toggled", { hidden: !hidden });
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          {hidden ? "Mostra importi" : "Nascondi importi"}
        </button>
      </div>
      <div className="rw amts" style={{ marginTop: 12 }}>
        <span className="d" style={{ background: "var(--a-liq)" }} /><b>Liquidità</b><span className="v">14.416 €</span>
      </div>
      <div className="rw amts">
        <span className="d" style={{ background: "var(--a-inv)" }} /><b>Investimenti</b><span className="v">39.070 €</span>
      </div>
    </div>
  );
}
