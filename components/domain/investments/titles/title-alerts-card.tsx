"use client";

import { localizedFormats, parseLocaleNumber } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";

/**
 * Card "Avvisi di prezzo": elenco degli avvisi del titolo (attivi e scattati) e form per crearne uno. La chiusura si
 * controlla ogni sera: quando raggiunge il livello arriva un'email, una volta sola.
 */

import * as React from "react";
import { BellIcon, BellRingIcon, Trash2Icon } from "lucide-react";
import { SegmentedControl } from "@/components/domain/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PriceAlertDirection, UserPriceAlert } from "@/lib/db/schema/investments";
import { ALERT_DIRECTION_LABELS } from "@/lib/investments/alerts";

import { useCreateAlertMutation, useDeleteAlertMutation } from "@/lib/queries/titles";

import { PanelSection } from "../panel-section";

const DIRECTION_OPTIONS: { value: PriceAlertDirection; label: string }[] = [
  { value: "sopra", label: "Sale sopra" },
  { value: "sotto", label: "Scende sotto" },
];

/** Positive number typed in the user's locale ("1.234,5" in Italian, "1,234.5" in English), or null if invalid. */
export function parseTargetInput(text: string, locale = "it-IT"): number | null {
  const value = parseLocaleNumber(text, locale);
  return value !== null && value > 0 ? value : null;
}

export interface TitleAlertsCardProps {
  instrumentId: string;
  currency: string;
  alerts: UserPriceAlert[];
  lastClose: number | null;
  /** Solo gli strumenti con prezzi automatici possono avere avvisi. */
  supported: boolean;
}

export function TitleAlertsCard({ instrumentId, currency, alerts, lastClose, supported }: TitleAlertsCardProps) {
  const { locale: formattingLocale } = useLocalization();
  const { formatPrice } = localizedFormats(formattingLocale);


  const { formatShortDate } = localizedFormats(formattingLocale);

  const { t: tr } = useLocalization();
  const [direction, setDirection] = React.useState<PriceAlertDirection>("sopra");
  const [target, setTarget] = React.useState("");
  const create = useCreateAlertMutation(instrumentId);
  const remove = useDeleteAlertMutation(instrumentId);
  const value = parseTargetInput(target, formattingLocale);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (value === null) return;
    create.mutate({ direction, targetPrice: value }, { onSuccess: () => setTarget("") });
  }

  return (
    <PanelSection icon={BellIcon} title={tr("Avvisi di prezzo")} color="var(--swatch-amber)">
      <div className="flex flex-col gap-4">
        {alerts.length > 0 ? (
          <ul className="flex flex-col divide-y rounded-lg border">
            {alerts.map((alert) => {
              const triggered = alert.status === "scattato";
              const Icon = triggered ? BellRingIcon : BellIcon;
              return (
                <li key={alert.id} className="flex items-center gap-3 px-3 py-2.5">
                  <Icon size={16} aria-hidden="true" className={triggered ? "text-primary" : "text-muted-foreground"} />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="text-foreground">
                      {tr(ALERT_DIRECTION_LABELS[alert.direction])[0].toUpperCase() + tr(ALERT_DIRECTION_LABELS[alert.direction]).slice(1)}{" "}
                      <span className="font-medium tabular-nums">{formatPrice(Number(alert.targetPrice), currency)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {triggered && alert.triggeredAt
                        ? tr("Scattato il {0} con la chiusura a {1}", {0: formatShortDate(new Date(alert.triggeredAt).toISOString().slice(0, 10)), 1: formatPrice(Number(alert.triggeredPrice), currency)})
                        : tr("In attesa: controllo ogni sera dopo la chiusura")}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={tr("Elimina avviso")}
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(alert.id)}
                  >
                    <Trash2Icon size={15} aria-hidden="true" />
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {supported ? tr("Nessun avviso. Ti scrivo per email quando la chiusura raggiunge il livello che scegli.") : tr("Gli avvisi funzionano solo per i titoli con prezzi automatici.")}
          </p>
        )}

        {supported ? (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <SegmentedControl options={DIRECTION_OPTIONS} value={direction} onChange={setDirection} ariaLabel={tr("Direzione dell'avviso")} stretch />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`alert-target-${instrumentId}`}>{tr("Livello (")}{currency}{")"}</Label>
              <div className="flex gap-2">
                <Input
                  id={`alert-target-${instrumentId}`}
                  inputMode="decimal"
                  placeholder={lastClose !== null ? tr("Ultima chiusura {0}", {0: formatPrice(lastClose, currency)}) : tr("Prezzo")}
                  value={target}
                  onChange={(event) => setTarget(event.target.value)}
                  aria-invalid={target.trim() !== "" && value === null}
                />
                <Button type="submit" disabled={value === null || create.isPending}>{tr("Crea avviso")}</Button>
              </div>
            </div>
            {create.isError ? (
              <p role="alert" className="text-sm text-destructive">
                {tr(create.error.message)}
              </p>
            ) : null}
          </form>
        ) : null}
      </div>
    </PanelSection>
  );
}
