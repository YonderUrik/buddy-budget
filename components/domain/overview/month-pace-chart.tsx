"use client";

/**
 * Curva della spesa cumulata del mese contro la media dei mesi precedenti: linea piena "tu", tratteggiata "di solito".
 * Le etichette sulle estremità dicono le cifre senza dipendere dal colore; la linea si disegna una volta all'apertura
 * (solo se l'utente non chiede meno animazioni).
 */

import * as React from "react";
import { formatCurrency } from "@/lib/format";
import type { MonthPace } from "@/lib/calc/month-pace";

/** Larghezza di partenza (e di riserva fuori dal browser): poi il disegno prende quella reale, così il testo resta leggibile su mobile. */
const DEFAULT_WIDTH = 600;
const HEIGHT = 200;
const PAD = { top: 22, right: 64, bottom: 28, left: 8 };
/** Margine sopra il valore massimo, così l'etichetta finale non esce dal disegno. */
const Y_HEADROOM = 1.12;

export interface MonthPaceChartProps {
  pace: MonthPace;
  currency: string;
}

export function MonthPaceChart({ pace, currency }: MonthPaceChartProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(DEFAULT_WIDTH);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(Math.max(240, Math.round(el.clientWidth)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const WIDTH = width;
  const { current, typical, daysInMonth, dayOfMonth } = pace;
  const max = Math.max(1, ...current, ...(typical ?? [0])) * Y_HEADROOM;
  const x = (day: number) =>
    PAD.left +
    ((day - 1) / Math.max(1, daysInMonth - 1)) * (WIDTH - PAD.left - PAD.right);
  const y = (value: number) =>
    PAD.top + (1 - value / max) * (HEIGHT - PAD.top - PAD.bottom);
  const path = (values: number[]) =>
    values
      .map(
        (v, i) =>
          `${i === 0 ? "M" : "L"}${x(i + 1).toFixed(1)} ${y(v).toFixed(1)}`,
      )
      .join(" ");
  const money = (n: number) =>
    formatCurrency(n, currency, { maximumFractionDigits: 0 });
  const todayX = x(dayOfMonth);
  const todayY = y(pace.spentSoFar);
  const typicalToday = typical ? typical[dayOfMonth - 1] : null;
  const summary = typical
    ? `Spesa cumulata del mese: ${money(pace.spentSoFar)} al giorno ${dayOfMonth}, contro ${money(typicalToday ?? 0)} di solito; a fine mese il solito arriva a ${money(typical[daysInMonth - 1])}.`
    : `Spesa cumulata del mese: ${money(pace.spentSoFar)} al giorno ${dayOfMonth}.`;

  return (
    <div ref={ref}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width={WIDTH}
        height={HEIGHT}
        className="block max-w-full overflow-visible"
        role="img"
        aria-label={summary}
      >
        <line
          x1={PAD.left}
          x2={WIDTH - PAD.right}
          y1={HEIGHT - PAD.bottom}
          y2={HEIGHT - PAD.bottom}
          stroke="var(--border)"
        />
        {typical ? (
          <>
            <path
              d={path(typical)}
              fill="none"
              stroke="var(--text-3)"
              strokeWidth={2}
              strokeDasharray="5 5"
            />
            <text
              x={x(daysInMonth) + 6}
              y={y(typical[daysInMonth - 1]) + 4}
              fontSize={13}
              fill="var(--text-2)"
            >
              {money(typical[daysInMonth - 1])}
            </text>
            <text
              x={x(daysInMonth) + 6}
              y={y(typical[daysInMonth - 1]) + 19}
              fontSize={12}
              fill="var(--text-3)"
            >
              di solito
            </text>
          </>
        ) : null}
        <path
          d={path(current)}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          className="month-pace-line"
        />
        <circle
          cx={todayX}
          cy={todayY}
          r={5}
          fill="var(--primary)"
          stroke="var(--card)"
          strokeWidth={2}
        />
        <text
          x={todayX}
          y={todayY - 12}
          fontSize={14}
          fontWeight={600}
          textAnchor="middle"
          fill="var(--foreground)"
        >
          {money(pace.spentSoFar)}
        </text>
        <g fontSize={12} fill="var(--text-3)">
          <text x={x(1)} y={HEIGHT - 8}>
            1
          </text>
          <text
            x={x(Math.ceil(daysInMonth / 2))}
            y={HEIGHT - 8}
            textAnchor="middle"
          >
            {Math.ceil(daysInMonth / 2)}
          </text>
          <text x={x(daysInMonth)} y={HEIGHT - 8} textAnchor="end">
            {daysInMonth}
          </text>
        </g>
      </svg>
    </div>
  );
}
