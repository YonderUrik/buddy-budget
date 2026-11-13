"use client";
import { CheckIcon, LockKeyholeIcon, ShieldCheckIcon, UserXIcon } from "lucide-react";
import { useLocalization } from "@/lib/localization/provider";
import { cn } from "@/lib/utils";
import { IBKR_FLEX_STEPS, IBKR_FLEX_TRUST } from "./ibkr-flex-text";

const TRUST_ICONS = [ShieldCheckIcon, UserXIcon, LockKeyholeIcon] as const;

/** «Solo lettura · Mai la password · Token cifrato» as tags, in place of three paragraphs of reassurance. */
export function IbkrFlexTrustTags() {
  const { t } = useLocalization();
  return (
    <ul className="flex flex-wrap gap-2" aria-label={t("Cosa fa il collegamento")}>
      {IBKR_FLEX_TRUST.map((label, index) => {
        const Icon = TRUST_ICONS[index];
        return (
          <li key={label} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-text-2">
            <Icon className="size-3.5 text-pos" aria-hidden="true" />{t(label)}
          </li>
        );
      })}
    </ul>
  );
}

export interface IbkrFlexStepIndicatorProps {
  current: number;
  /** Every step ticked (the connection succeeded). */
  done?: boolean;
}

/** «1 Query · 2 Query ID · 3 Token», with the steps behind ticked and the current one highlighted. */
export function IbkrFlexStepIndicator({ current, done = false }: IbkrFlexStepIndicatorProps) {
  const { t } = useLocalization();
  return (
    <ol className="flex items-center gap-2 text-xs font-medium" aria-label={t("Passaggi")}>
      {IBKR_FLEX_STEPS.map((label, index) => {
        const ticked = done || index < current;
        const active = !done && index === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-2" aria-current={active ? "step" : undefined}>
            <span className={cn("grid size-6 shrink-0 place-items-center rounded-full tabular-nums", ticked ? "bg-pos-soft text-pos" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
              {ticked ? <CheckIcon className="size-3.5" aria-hidden="true" /> : index + 1}
            </span>
            <span className={ticked || active ? "text-foreground" : "text-muted-foreground"}>{t(label)}</span>
            {index < IBKR_FLEX_STEPS.length - 1 ? <span className="h-px flex-1 bg-border" aria-hidden="true" /> : null}
          </li>
        );
      })}
    </ol>
  );
}

export interface IbkrFlexSettingsProps {
  /** Our label (translated) and IBKR's option, shown as IBKR names it unless `translateValue`. */
  rows: readonly { label: string; value: string }[];
  translateValue?: boolean;
}

/** The options to pick in IBKR, as a short two-column table instead of a sentence. */
export function IbkrFlexSettings({ rows, translateValue = false }: IbkrFlexSettingsProps) {
  const { t } = useLocalization();
  return (
    <dl className="flex flex-col rounded-2xl bg-muted/60 px-4 py-1.5">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-4 py-2 text-sm">
          <dt className="text-text-2">{t(row.label)}</dt>
          <dd className="text-right font-semibold text-foreground">{translateValue ? t(row.value) : row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
