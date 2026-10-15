"use client";
import { t as trLanding } from "@/lib/localization";

import type { CSSProperties } from "react";
import { DEBT_PANEL, FIRE_PANEL, PERFORMANCE_PANEL, TAX_PANEL } from "@/content/story";
import { Counter, Swap } from "./counter";
import type { LivePanelProps } from "./live-movements";

/** Quote dell'asse verticale del grafico degli investimenti (viewBox 480×262). */
const PERFORMANCE_GRIDLINES = [60, 112, 164, 216];

/** «Come vanno gli investimenti»: due linee (quanto vale, quanto hai versato) che si disegnano, i numeri chiave e i quattro mesi. */
export function PerformancePanel({ on }: LivePanelProps) {
  const p = PERFORMANCE_PANEL;
  return (
    <div className={`live inv${on ? " on" : ""}`} aria-hidden="true">
      <div className="lh">
        <b>{trLanding(p.title)}</b>
        <span>{trLanding(p.subtitle)}</span>
      </div>
      <div className="grid">
        <div>
          <svg className="chart" viewBox="0 0 480 262">
            <g className="gridlines">
              {PERFORMANCE_GRIDLINES.map((y) => <path key={y} d={`M10,${y} L450,${y}`} />)}
            </g>
            <path className="fade p-area" d={p.areaPath} />
            <path className="draw p-paid" d={p.paidPath} pathLength={1} />
            <path className="draw p-value" d={p.valuePath} pathLength={1} />
            <g className="fade">
              {p.axis.map((a) => <text key={a.label} x={a.x} y={248}>{trLanding(a.label)}</text>)}
            </g>
          </svg>
          <p className="lg">
            <span><i className="l-value" />{trLanding(p.legend.value)}</span>
            <span><i className="l-paid" /><em className="opt">{trLanding(p.legend.paidLong)}</em>{trLanding(p.legend.paid)}</span>
          </p>
        </div>
        <div className="kpi">
          {p.kpis.map((k) => (
            <p key={k.label} className="k">
              <small>{trLanding(k.label)}</small>
              <b className={"tone" in k ? k.tone : undefined}>{trLanding(k.value)}</b>
            </p>
          ))}
        </div>
      </div>
      <div className="months">
        {p.months.map((m, i) => (
          <span key={m.short} className={m.tone} style={{ "--i": i } as CSSProperties}>
            <small>{trLanding(m.short)}<i>{trLanding(m.rest)}</i></small>
            {trLanding(m.value)}
          </span>
        ))}
      </div>
      <p className="st">{trLanding(p.status)}</p>
    </div>
  );
}

/** «Quanto pago di tasse se vendo»: lo scontrino della vendita, una riga alla volta. */
export function TaxPanel({ on }: LivePanelProps) {
  const p = TAX_PANEL;
  return (
    <div className={`live tax${on ? " on" : ""}`} aria-hidden="true">
      <div className="lh">
        <b>{trLanding(p.title)}</b>
        <span>{trLanding(p.subtitle)} · <b>{trLanding(p.quantity)}</b></span>
      </div>
      <ul className="rcpt">
        {p.rows.map((r, i) => (
          <li key={r.label} className={"kind" in r ? (r.kind === "total" ? "tot" : "sum") : undefined} style={{ "--i": i } as CSSProperties}>
            <span>{trLanding(r.label)} {"detail" in r ? <i className="opt">{trLanding(r.detail)}</i> : null}</span>
            <em className={"tone" in r ? r.tone : undefined}>{trLanding(r.value)}</em>
          </li>
        ))}
      </ul>
      <p className="st">{trLanding(p.status)}</p>
    </div>
  );
}

/** «Mi conviene estinguere il mutuo prima»: il cursore sale a 200 €, la barra del tempo si accorcia, i risultati cambiano. */
export function DebtPanel({ on }: LivePanelProps) {
  const p = DEBT_PANEL;
  return (
    <div className={`live debt${on ? " on" : ""}`} aria-hidden="true">
      <div className="lh">
        <b>{trLanding(p.title)}</b>
        <span>{trLanding(p.subtitle)} <b>{trLanding(p.residual)}</b> {trLanding(p.residualTail)}</span>
      </div>
      <div className="cur move" style={{ "--p": `${p.slider.position}%`, "--p2": `${p.slider.positionAfter}%` } as CSSProperties}>
        <span>{trLanding(p.slider.label)}</span>
        <Counter from={p.slider.from} to={p.slider.to} format="eur" on={on} />
        <div className="track"><i className="knob" /></div>
      </div>
      <div className="bars">
        <div className="row">
          <span>{trLanding(p.bars.today.label)}</span>
          <div className="tr"><i className="fill" style={{ "--w": `${p.bars.today.width}%` } as CSSProperties} /></div>
          <em className="end">{trLanding(p.bars.today.end)}</em>
        </div>
        <div className="row">
          <span>{trLanding(p.bars.extra.label)}</span>
          <div className="tr"><i className="fill b" style={{ "--w": `${p.bars.extra.width}%`, "--w2": `${p.bars.extra.widthAfter}%` } as CSSProperties} /></div>
          <Swap as="em" className="end" before={p.bars.extra.end} after={p.bars.extra.endAfter} delay={1300} on={on} />
        </div>
        <div className="row">
          <span />
          <div className="ax">
            {p.bars.axis.map((a) => <span key={a.label} style={{ left: `${a.at}%` }}>{trLanding(a.label)}</span>)}
          </div>
          <span />
        </div>
      </div>
      <div className="res">
        <p className="k">
          <small>{trLanding(p.results.when.label)}</small>
          <Swap before={p.results.when.before} after={p.results.when.after} delay={1500} on={on} />
        </p>
        <p className="k">
          <small>{trLanding(p.results.saved.label)}</small>
          <Counter className="pos" from={p.results.saved.from} to={p.results.saved.to} format="eur" delay={1500} on={on} />
        </p>
      </div>
      <ol className="order">
        {p.order.map((o, i) => (
          <li key={o.name} style={{ "--i": i } as CSSProperties}>
            <i>{trLanding(i + 1)}</i>
            <b>{trLanding(o.name)}</b>
            <em>{trLanding(o.detail)}</em>
          </li>
        ))}
      </ol>
      <p className="st">{trLanding(p.status)}</p>
    </div>
  );
}

/** «Quando posso smettere di lavorare»: il cursore del risparmio sale di 200 € e l'anno di arrivo si sposta, con la curva nuova. */
export function FirePanel({ on }: LivePanelProps) {
  const p = FIRE_PANEL;
  const savings = p.sliders[0];
  return (
    <div className={`live fire${on ? " on" : ""}`} aria-hidden="true">
      <div className="lh">
        <b>{trLanding(p.title)}</b>
        <span>{trLanding(p.subtitle)} <b>{trLanding(p.subtitleStrong)}</b></span>
      </div>
      <div className="grid">
        <div className="year">
          <small>{trLanding(p.year.label)}</small>
          <Counter from={p.year.from} to={p.year.to} format="year" delay={900} on={on} />
          <Swap as="span" before={p.year.before} after={p.year.after} delay={1700} on={on} />
        </div>
        <svg className="chart" viewBox="0 0 460 170">
          <path className="p-fire" d="M10,34 L450,34" />
          <text x={10} y={26}>{trLanding(p.chart.fireLabel)}</text>
          <path className="p-base" d={p.chart.basePath} />
          <path className="draw p-extra" d={p.chart.extraPath} pathLength={1} />
          <g className="fade">
            <text x={p.chart.baseYear.x} y={26} textAnchor="middle">{trLanding(p.chart.baseYear.label)}</text>
            <text className="y-extra" x={p.chart.extraYear.x} y={26} textAnchor="middle">{trLanding(p.chart.extraYear.label)}</text>
          </g>
          <text x={10} y={166}>{trLanding(p.chart.todayLabel)}</text>
        </svg>
      </div>
      <div className="curs">
        {p.sliders.map((s) => (
          <div
            key={s.label}
            className={`cur${"counter" in s ? " move" : ""}${"phoneHidden" in s ? " hide" : ""}`}
            style={{ "--p": `${s.position}%`, "--p2": "positionAfter" in s ? `${s.positionAfter}%` : undefined } as CSSProperties}
          >
            <span>{trLanding(s.label)}</span>
            {"counter" in s ? <Counter from={s.from} to={s.to} format="eur" on={on} /> : <b>{trLanding(s.value)}</b>}
            <div className="track"><i className="knob" /></div>
          </div>
        ))}
      </div>
      <div className="ans">
        {p.answers.map((a, i) => (
          <p key={a.label} className="k" style={{ "--i": i } as CSSProperties}>
            <small>{trLanding(a.label)}</small>
            {"year" in a ? (
              <Counter from={p.year.from} to={p.year.to} format="year" delay={900} on={on} />
            ) : "savings" in a ? (
              <Counter from={savings.from} to={savings.to} format="eur" on={on} />
            ) : (
              <b>{trLanding(a.value)}</b>
            )}
          </p>
        ))}
      </div>
    </div>
  );
}
