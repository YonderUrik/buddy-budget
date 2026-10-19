"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BillingStatus } from "@/lib/billing/status";
import { localizedFormats } from "@/lib/localization/format";
import { useLocalization } from "@/lib/localization/provider";
import { planStatusLine } from "./plan-status";

export interface PlanStatusCardProps {
  status: BillingStatus;
  /** Shows «Gestisci abbonamento» (hidden in the native app, where purchases are not managed). */
  canManage: boolean;
  managing: boolean;
  onManage: () => void;
  error?: string | null;
}

/** One sentence on the account's plan (trial, renewal, cancellation, failed payment, free Pro) and the button to the Stripe portal. */
export function PlanStatusCard({ status, canManage, managing, onManage, error }: PlanStatusCardProps) {
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
        return tr("Sei sul piano gratuito: Liquidità è aperta, le altre sezioni sono di Pro.");
    }
  })();
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-card p-5">
      <p className="text-sm">{sentence}</p>
      {canManage && status.hasCustomer ? (
        <Button type="button" variant="outline" className="w-fit rounded-full" disabled={managing} onClick={onManage}>
          {managing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {tr("Gestisci abbonamento")}
        </Button>
      ) : null}
      {error ? <p role="alert" className="text-sm text-neg">{error}</p> : null}
    </section>
  );
}
