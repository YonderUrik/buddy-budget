"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { GROUPS, MOVEMENTS_PANEL, type SpendGroup } from "@/content/story";

/** Spazio (px) tra le colonne dei movimenti. */
const GAP = 12;
/** Colonne quando i movimenti sono «appena arrivati» e quando sono nei quattro gruppi. */
const INBOX_COLS = 3;
const GROUP_COLS = GROUPS.length;
/** Passo verticale (px) tra una riga di movimenti e l'altra, e offset sotto l'etichetta d'arrivo / le testate dei gruppi. */
const ROW_STEP = 32 + 6;
const INBOX_TOP = 22;
const GROUP_TOP = 62;
/** Larghezza usata prima della misura vera (lato server): i movimenti vengono poi sistemati al montaggio. */
const FALLBACK_WIDTH = 660;

/** Token del colore di ogni gruppo di spesa (gli stessi di `--group-*` nell'app). */
const GROUP_COLOR: Record<SpendGroup, string> = { dovuta: "var(--a-dov)", voluta: "var(--a-vol)", futuro: "var(--a-fut)", saltuaria: "var(--a-sal)" };
const STATUS_COLOR = { primary: "var(--primary)", pos: "var(--a-pos)", none: "var(--a-none)" } as const;

export interface LivePanelProps {
  /** Il pannello è quello in vista: parte l'animazione. */
  on: boolean;
}

/**
 * «Dove vanno i soldi»: quindici movimenti appena arrivati dalla banca che, quando il pannello si accende, scivolano
 * ciascuno nella colonna del suo gruppo. Le posizioni sono calcolate dalla larghezza vera della lavagna.
 */
export function MovementsPanel({ on }: LivePanelProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(FALLBACK_WIDTH);

  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const measure = () => setWidth(board.clientWidth || FALLBACK_WIDTH);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(board);
    return () => observer.disconnect();
  }, []);

  const inboxWidth = (width - GAP * (INBOX_COLS - 1)) / INBOX_COLS;
  const groupWidth = (width - GAP * (GROUP_COLS - 1)) / GROUP_COLS;
  const perGroup: Record<SpendGroup, number> = { dovuta: 0, voluta: 0, futuro: 0, saltuaria: 0 };
  const movements = MOVEMENTS_PANEL.movements.map((m, i) => {
    const g = GROUPS.findIndex((group) => group.id === m.group);
    const row = perGroup[m.group]++;
    const transform = on
      ? `translate(${g * (groupWidth + GAP)}px, ${GROUP_TOP + row * ROW_STEP}px)`
      : `translate(${(i % INBOX_COLS) * (inboxWidth + GAP)}px, ${INBOX_TOP + Math.floor(i / INBOX_COLS) * ROW_STEP}px)`;
    return { ...m, style: { "--c": GROUP_COLOR[m.group], "--i": i, width: on ? groupWidth : inboxWidth, transform } as CSSProperties };
  });

  return (
    <div className={`live${on ? " on" : ""}`} aria-hidden="true">
      <div className="lh">
        <b>{MOVEMENTS_PANEL.title}</b>
        <span>
          {MOVEMENTS_PANEL.subtitle}
          <b>{MOVEMENTS_PANEL.total}</b>
        </span>
      </div>
      <div className="board" ref={boardRef}>
        <p className="in">{MOVEMENTS_PANEL.inbox}</p>
        {MOVEMENTS_PANEL.groups.map((g, i) => (
          <div key={g.id} className="gh" style={{ "--c": GROUP_COLOR[g.id], "--w": `${g.share}%`, left: i * (groupWidth + GAP), width: groupWidth } as CSSProperties}>
            <b>{GROUPS[i].label}</b>
            <div className="t">{g.total}</div>
            <div className="gbar"><i /></div>
          </div>
        ))}
        {movements.map((m) => (
          <div key={m.name} className="mv" style={m.style}>
            <i />
            <span>{m.name}</span>
            <em>{m.amount}</em>
          </div>
        ))}
        <p className="st">
          {MOVEMENTS_PANEL.status.map((s) => (
            <span key={s.text}>
              <i style={{ "--dot": STATUS_COLOR[s.tone] } as CSSProperties} />
              <b>{s.count}</b> {s.text}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}

/** La stessa risposta sul telefono: quattro barre dei gruppi e una lista corta i cui pallini prendono colore. */
export function MovementsPhonePanel({ on }: LivePanelProps) {
  return (
    <div className={`plive${on ? " on" : ""}`} aria-hidden="true">
      <p className="lh">
        {MOVEMENTS_PANEL.phoneTitle}
        <span>{MOVEMENTS_PANEL.phoneSubtitle}</span>
      </p>
      {MOVEMENTS_PANEL.groups.map((g, i) => (
        <div key={g.id} className="g" style={{ "--c": GROUP_COLOR[g.id], "--w": `${g.share}%` } as CSSProperties}>
          <b>
            <span>{GROUPS[i].label}</span>
            <em>{g.total}</em>
          </b>
          <div className="gbar"><i /></div>
        </div>
      ))}
      <ul>
        {MOVEMENTS_PANEL.phoneMovements.map((m, i) => (
          <li key={m.name} style={{ "--i": i, "--c": GROUP_COLOR[m.group] } as CSSProperties}>
            <i />
            <span>{m.name}</span>
            <em>{m.amount}</em>
          </li>
        ))}
      </ul>
    </div>
  );
}
