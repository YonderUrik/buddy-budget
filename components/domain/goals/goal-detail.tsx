"use client";

/**
 * Dettaglio di un obiettivo: quanto c'è (cifra grande), quanto serve e per quando, lo stato in una frase, le fonti
 * divise per sezione con l'imposta stimata sui titoli, cosa cambia quando lo raggiungi e le azioni.
 */

import * as React from "react";
import { ArrowLeftRightIcon, FlagIcon } from "lucide-react";
import { AnimatedNumber } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { KEPT_GOAL_KINDS } from "@/lib/goals/constants";
import type { GoalView } from "@/lib/goals/view";
import { AMOUNT_MASK } from "@/lib/format";
import { useLocalization } from "@/lib/localization/provider";
import { LogoCredit, PAGE_TITLE } from "@/components/domain/shared";
import { GOAL_KIND_INFO } from "./goal-kinds";
import { fireShiftText, statusLabel, statusSentence, type GoalFormatters } from "./goal-format";
import { GoalIcon } from "./goal-icon";
import { GoalSourceIcon } from "./goal-source-icon";
import { GoalNote } from "./goal-note";
import { GoalProgress } from "./goal-progress";
import { GoalSectionHeading } from "./goal-section-heading";

export interface GoalDetailProps {
  goal: GoalView;
  currency: string;
  fmt: GoalFormatters;
  /** Anno del traguardo con tutti gli obiettivi; null se non si sa. */
  fireYear: number | null;
  onAddMoney: () => void;
  onEdit: () => void;
  onToggleAchieved: () => void;
  onDelete: () => void;
  pending?: boolean;
}

const GROUPS = [
  { kind: "account", title: "Liquidità" },
  { kind: "instrument", title: "Investimenti" },
] as const;

export function GoalDetail({ goal, currency, fmt, fireYear, onAddMoney, onEdit, onToggleAchieved, onDelete, pending = false }: GoalDetailProps) {
  const { t: tr, locale } = useLocalization();
  const info = GOAL_KIND_INFO[goal.kind];
  const label = statusLabel(goal, tr);
  const shift = fireShiftText(goal, tr);
  const hidden = fmt.money(0) === AMOUNT_MASK;
  const tax = goal.sources.reduce((sum, s) => sum + s.tax, 0);
  const kept = KEPT_GOAL_KINDS.includes(goal.kind);
  const [logosShown, setLogosShown] = React.useState(false);
  const showLogoCredit = React.useCallback(() => setLogosShown(true), []);
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <GoalIcon icon={info.icon} color={info.color} size="lg" />
          <h1 className={PAGE_TITLE}>{goal.name}</h1>
        </div>
        <p className="font-heading text-5xl font-medium tabular-nums text-foreground">
          {hidden ? AMOUNT_MASK : <AnimatedNumber value={goal.current} format={{ style: "currency", currency }} locales={locale} mutedTail />}
        </p>
        <p className="text-text-2">
          {goal.targetDate ? tr("di {0} · entro {1}", { 0: fmt.money(goal.target), 1: fmt.month(goal.targetDate) }) : tr("di {0}", { 0: fmt.money(goal.target) })}
        </p>
        <GoalProgress progress={goal.progress} status={goal.status} label={tr("Avanzamento di {0}", { 0: goal.name })} className="h-2" />
        <p className="font-heading text-lg font-medium text-foreground">{label ? `${label}.` : null}</p>
        <p className="-mt-2 text-text-2">{statusSentence(goal, fmt, tr)}</p>
      </div>

      <section aria-labelledby="goal-sources" className="flex flex-col gap-3">
        <GoalSectionHeading id="goal-sources" icon={ArrowLeftRightIcon} title={tr("Da dove arrivano i soldi")} color="var(--swatch-blue)" />
        {goal.sources.length === 0 ? <p className="text-sm text-text-2">{tr("Nessun conto o titolo assegnato: l'obiettivo cresce solo con la quota del mese, quando aggiorni quanto hai messo da parte.")}</p> : null}
        {GROUPS.map((group) => {
          const items = goal.sources.filter((s) => s.kind === group.kind);
          if (items.length === 0) return null;
          return (
            <div key={group.kind} className="flex flex-col">
              <p className="pb-1 text-sm font-medium text-text-3">{tr(group.title)}</p>
              <ul>
                {items.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 border-b py-3 last:border-b-0">
                    <GoalSourceIcon source={s} onRemoteLogo={showLogoCredit} />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium text-foreground">{s.name}</span>
                      <span className="text-sm text-text-3">
                        {s.kind === "account"
                          ? tr("{0} dei {1} sul conto", { 0: fmt.money(s.amount), 1: fmt.money(s.total) })
                          : tr("{0} dei {1} della posizione · imposta stimata {2}", { 0: fmt.money(s.amount), 1: fmt.money(s.total), 2: fmt.money(s.tax) })}
                        {s.short ? ` · ${tr("oggi ne trovi solo una parte")}` : ""}
                      </span>
                    </div>
                    <span className="shrink-0 font-heading font-medium tabular-nums text-foreground">{fmt.money(s.counted)}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        <LogoCredit visible={logosShown} />
        {tax > 0 ? <GoalNote>{tr("Per i titoli contiamo il valore al netto dell'imposta stimata se vendessi oggi, con l'aliquota del titolo e senza le minusvalenze da compensare: la scheda Tasse fa il calcolo completo.")}</GoalNote> : null}
      </section>

      {goal.status !== "raggiunto" ? (
        <section aria-labelledby="goal-after" className="flex flex-col gap-3">
          <GoalSectionHeading id="goal-after" icon={FlagIcon} title={tr("Cosa cambia quando lo raggiungi")} color="var(--swatch-amber)" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1 border-t pt-3">
              <span className="text-sm text-text-2">{tr("Patrimonio")}</span>
              <span className="font-heading text-2xl font-medium tabular-nums text-foreground">{kept ? fmt.money(0) : `−${fmt.money(goal.target)}`}</span>
              <span className="text-sm text-text-3">{kept ? tr("i soldi restano tuoi, da parte") : goal.etaMonth ? tr("escono a {0}", { 0: fmt.month(goal.etaMonth) }) : tr("escono quando lo raggiungi")}</span>
            </div>
            <div className="flex flex-col gap-1 border-t pt-3">
              <span className="text-sm text-text-2">{tr("Smetti di lavorare")}</span>
              <span className="font-heading text-2xl font-medium tabular-nums text-foreground">{fireYear ?? "—"}</span>
              <span className="text-sm text-text-3">{shift ?? tr("serve sapere spesa e risparmio nelle Risposte")}</span>
            </div>
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" className="h-11 sm:h-9" onClick={onAddMoney} disabled={pending}>
          {tr("Aggiorna i soldi da parte")}
        </Button>
        <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={onEdit} disabled={pending}>
          {tr("Modifica")}
        </Button>
        <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={onToggleAchieved} disabled={pending}>
          {goal.achievedAt ? tr("Riapri") : tr("Segna come raggiunto")}
        </Button>
        <Button type="button" variant="ghost" className="h-11 text-destructive sm:h-9" onClick={onDelete} disabled={pending}>
          {tr("Elimina")}
        </Button>
      </div>
    </div>
  );
}
