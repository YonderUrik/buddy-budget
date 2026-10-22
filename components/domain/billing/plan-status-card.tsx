"use client";

import type * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BillingStatus } from "@/lib/billing/status";
import { localizedFormats } from "@/lib/localization/format";
import { useLocalization } from "@/lib/localization/provider";
import { cn } from "@/lib/utils";
import { planStatusLine } from "./plan-status";

export interface PlanStatusCardProps {
  status: BillingStatus;
  /** Shows «Gestisci abbonamento» (hidden in the native app, where purchases are not managed). */
  canManage: boolean;
  managing: boolean;
  onManage: () => void;
  error?: string | null;
  /** Replaces the portal button (Settings links to the plans page instead). */
  action?: React.ReactNode;
}

/**
 * The account's plan as a filled block: the plan's name in the display face, one sentence on where it stands (trial,
 * renewal, cancellation, failed payment, free Pro, Free) and the button to the Stripe portal or the caller's action.
 */
export function PlanStatusCard({ status, canManage, managing, onManage, error, action }: PlanStatusCardProps) {
  const { t: tr, locale } = useLocalization();
  const { formatLongDate } = localizedFormats(locale);
  const line = planStatusLine(status);
  const date = (value: string) => formatLongDate(new Date(value));
  const sentence = (() => {
    switch (line.kind) {
      case "trial":
        return line.cancels
          ? tr("Prova gratuita fino al {0}: hai annullato, poi torni al piano gratuito.", { 0: date(line.date) })
          : tr("Prova gratuita fino al {0}, poi parte l'abbonamento.", { 0: date(line.date) });
      case "active":
        return line.cancels
          ? tr("Pro attivo fino al {0}, poi torni al piano gratuito.", { 0: date(line.date) })
          : tr("Pro attivo. Si rinnova il {0}.", { 0: date(line.date) });
      case "past_due":
        return tr("Il pagamento non è andato a buon fine: aggiorna la carta entro il {0} per tenere Pro.", { 0: date(line.date) });
      case "suspended":
        return tr("L'abbonamento è sospeso: aggiorna il metodo di pagamento per riattivare Pro.");
      case "grant":
        return line.date ? tr("Pro gratuito fino al {0}.", { 0: date(line.date) }) : tr("Pro gratuito, senza scadenza.");
      case "free":
        return tr("Liquidità è aperta, le altre sezioni sono di Pro.");
    }
  })();
  const warning = line.kind === "past_due" || line.kind === "suspended";
  const button =
    action ??
    (canManage && status.hasCustomer ? (
      <Button type="button" variant={warning ? "sun" : "outline"} className="h-11 w-fit shrink-0 rounded-full px-5" disabled={managing} onClick={onManage}>
        {managing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        {warning ? tr("Aggiorna la carta") : tr("Gestisci abbonamento")}
      </Button>
    ) : null);
  return (
    <section aria-label={tr("Il tuo piano")} className="flex flex-col gap-4 rounded-2xl bg-card p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-sm text-text-2">{tr("Il tuo piano")}</p>
        <p className="font-display text-4xl leading-none font-light">{status.plan.tier === "pro" ? tr("Pro") : tr("Gratis")}</p>
        <p className={cn("mt-1 max-w-[60ch] text-sm", warning ? "text-neg" : "text-text-2")}>{sentence}</p>
        {error ? <p role="alert" className="text-sm text-neg">{error}</p> : null}
      </div>
      {button}
    </section>
  );
}
