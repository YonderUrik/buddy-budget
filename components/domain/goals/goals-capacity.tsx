"use client";

/**
 * Testata della vista Obiettivi: quanto metti da parte al mese contro quanto chiedono gli obiettivi, e una barra che
 * mostra chi riceve cosa in ordine di priorità (il resto va al traguardo, quello che manca è tratteggiato).
 */

import type { GoalsView } from "@/lib/goals/view";
import { useLocalization } from "@/lib/localization/provider";
import { FIRE_GOAL_INFO, GAP_COLOR, GOAL_KIND_INFO } from "./goal-kinds";
import type { GoalFormatters } from "./goal-format";

export interface GoalsCapacityProps {
  view: GoalsView;
  fmt: GoalFormatters;
}

interface Segment {
  key: string;
  label: string;
  value: number;
  color: string;
  dashed?: boolean;
}

export function GoalsCapacity({ view, fmt }: GoalsCapacityProps) {
  const { t: tr } = useLocalization();
  const { capacity, requested, allocated, gap } = view;
  const open = view.goals.filter((g) => g.status !== "raggiunto");

  if (capacity === null) {
    return (
      <div className="flex flex-col gap-2">
        <h2 className="font-heading text-2xl font-medium tracking-tight text-foreground sm:text-3xl">{tr("Non sappiamo ancora quanto risparmi al mese.")}</h2>
        <p className="text-sm text-text-2">{tr("Servono almeno tre mesi di movimenti, oppure scrivi il tuo risparmio nelle ipotesi delle Risposte. Intanto gli obiettivi tengono il conto di quanto hai già messo da parte.")}</p>
      </div>
    );
  }

  const left = Math.max(0, capacity - allocated);
  const segments: Segment[] = [
    ...open.filter((g) => g.funded > 0.5).map((g) => ({ key: g.id, label: g.name, value: g.funded, color: GOAL_KIND_INFO[g.kind].color })),
    ...(left > 0.5 && view.fire ? [{ key: "fire", label: tr("Traguardo"), value: left, color: FIRE_GOAL_INFO.color }] : []),
    ...(left > 0.5 && !view.fire ? [{ key: "free", label: tr("Liberi"), value: left, color: "var(--muted-foreground)" }] : []),
    ...(gap > 0.5 ? [{ key: "gap", label: tr("Mancano"), value: gap, color: GAP_COLOR, dashed: true }] : []),
  ];
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const lowest = open.filter((g) => g.funded + 0.5 < g.monthly).at(-1);

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-heading text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
        {capacity <= 0 ? tr("In questo periodo hai speso più di quanto hai incassato.") : tr("Metti da parte {0} al mese.", { 0: fmt.money(capacity) })}
        {requested > 0 ? (
          <>
            <br />
            <span className="text-text-2">{tr("I tuoi obiettivi ne chiedono {0}.", { 0: fmt.money(requested) })}</span>
          </>
        ) : null}
      </h2>
      <p className="text-sm text-text-2">
        {capacity <= 0
          ? tr("Finché resta così gli obiettivi non ricevono niente: contano solo i soldi che hai già messo da parte.")
          : gap > 0.5
            ? tr("Il risparmio va agli obiettivi nell'ordine che scegli. Ne mancano {0} al mese: {1} resta indietro.", { 0: fmt.money(gap), 1: lowest?.name ?? tr("l'ultimo della lista") })
            : left > 0.5
              ? view.fire
                ? tr("Il risparmio va agli obiettivi nell'ordine che scegli; i {0} che avanzano vanno verso il traguardo.", { 0: fmt.money(left) })
                : tr("Il risparmio va agli obiettivi nell'ordine che scegli; ne avanzano {0} al mese.", { 0: fmt.money(left) })
              : tr("Il risparmio va agli obiettivi nell'ordine che scegli.")}
      </p>
      {total > 0 ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex h-8 w-full gap-0.5 overflow-hidden rounded-lg" role="img" aria-label={segments.map((s) => `${s.label} ${fmt.money(s.value)}`).join(", ")}>
            {segments.map((s) => (
              <div
                key={s.key}
                className="flex min-w-0 items-center overflow-hidden px-2 text-xs font-semibold whitespace-nowrap"
                style={{
                  flexGrow: s.value,
                  flexBasis: 0,
                  color: s.dashed ? s.color : "var(--background)",
                  backgroundColor: s.dashed ? "transparent" : s.color,
                  border: s.dashed ? `1.5px dashed ${s.color}` : undefined,
                }}
                title={`${s.label} ${fmt.money(s.value)}`}
              >
                <span className="truncate">{s.dashed ? `−${fmt.money(s.value)}` : `${s.label} ${fmt.money(s.value)}`}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-text-3">
            <span>0</span>
            <span>{fmt.money(Math.max(capacity, 0) + gap)}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
