"use client";

/**
 * Terzo passo: da dove arrivano i soldi. Conti e posizioni con la parte ancora libera; toccando una riga si assegna
 * una parte (proposta: quanto manca, fino al libero). È un'etichetta: i saldi veri non cambiano.
 */

import { LandmarkIcon, TrendingUpIcon } from "lucide-react";
import { CurrencyInput } from "@/components/domain/accounts";
import { StepHeading } from "@/components/domain/shared";
import type { FreeSource } from "@/lib/goals/view";
import { useLocalization } from "@/lib/localization/provider";
import { cn } from "@/lib/utils";
import { assignedTotal, sourceKey, type GoalDraft } from "./goal-form-state";
import type { GoalFormatters } from "./goal-format";
import { GoalIcon } from "./goal-icon";
import { GoalNote } from "./goal-note";

export interface GoalSourcesStepProps {
  draft: GoalDraft;
  sources: FreeSource[];
  currency: string;
  fmt: GoalFormatters;
  onChange: (sources: GoalDraft["sources"]) => void;
}

const GROUPS = [
  { kind: "account", title: "Liquidità", icon: LandmarkIcon, color: "var(--swatch-teal)" },
  { kind: "instrument", title: "Investimenti", icon: TrendingUpIcon, color: "var(--swatch-blue)" },
] as const;

export function GoalSourcesStep({ draft, sources, currency, fmt, onChange }: GoalSourcesStepProps) {
  const { t: tr } = useLocalization();
  const assigned = assignedTotal(draft);
  const toggle = (source: FreeSource) => {
    const key = sourceKey(source.kind, source.id);
    const next = { ...draft.sources };
    if (key in next) delete next[key];
    else next[key] = Math.max(0, Math.min(source.free, Math.max(0, (draft.target ?? 0) - assigned))) || Math.max(0, Math.floor(source.free));
    onChange(next);
  };
  return (
    <>
      <StepHeading title={tr("Da dove arrivano i soldi?")} description={tr("Scegli cosa è già per questo obiettivo. Puoi anche partire da zero.")} />
      {sources.length === 0 ? <p className="text-sm text-text-2">{tr("Non hai ancora conti né investimenti: l'obiettivo parte da zero e cresce con la quota del mese.")}</p> : null}
      {GROUPS.map((group) => {
        const items = sources.filter((s) => s.kind === group.kind);
        if (items.length === 0) return null;
        return (
          <div key={group.kind} className="flex flex-col">
            <p className="border-b pb-1.5 text-xs font-semibold uppercase tracking-wide text-text-3">{tr(group.title)}</p>
            <ul>
              {items.map((source) => {
                const key = sourceKey(source.kind, source.id);
                const value = draft.sources[key];
                const selected = value !== undefined;
                return (
                  <li key={key} className="flex items-center gap-3 border-b py-2.5 last:border-b-0">
                    <button type="button" aria-pressed={selected} onClick={() => toggle(source)} className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-ring">
                      <GoalIcon icon={group.icon} color={group.color} size="sm" />
                      <span className="flex min-w-0 flex-col">
                        <span className={cn("truncate text-sm font-medium", selected ? "text-primary" : "text-foreground")}>{source.name}</span>
                        <span className="text-xs text-text-3">{tr("{0} · {1} liberi", { 0: fmt.money(source.total), 1: fmt.money(source.free) })}</span>
                      </span>
                    </button>
                    {selected ? (
                      <CurrencyInput
                        value={value}
                        currency={currency}
                        onChange={(amount) => onChange({ ...draft.sources, [key]: Math.max(0, amount ?? 0) })}
                        className="h-11 w-28 text-right sm:h-9"
                        aria-label={tr("Parte di {0} per questo obiettivo", { 0: source.name })}
                      />
                    ) : (
                      <span className="text-sm text-text-3">{tr("Scegli")}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      <GoalNote>
        {tr("Assegnati {0} di {1}. Dove li tieni non cambia il saldo dei conti: è solo un'etichetta. Per i titoli contiamo il valore al netto dell'imposta stimata se li vendessi oggi.", { 0: fmt.money(assigned), 1: fmt.money(draft.target ?? 0) })}
      </GoalNote>
    </>
  );
}
