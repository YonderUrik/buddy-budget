"use client";

/**
 * Card "Avvisi di prezzo": elenco degli avvisi del titolo (attivi e scattati) e form per crearne uno. La chiusura si
 * controlla ogni sera: quando raggiunge il livello arriva un'email, una volta sola.
 */

import * as React from "react";
import { BellIcon, BellRingIcon, Trash2Icon } from "lucide-react";
import { SegmentedControl } from "@/components/domain/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PriceAlertDirection, UserPriceAlert } from "@/lib/db/schema/investments";
import { ALERT_DIRECTION_LABELS } from "@/lib/investments/alerts";
import { formatShortDate } from "@/lib/format";
import { useCreateAlertMutation, useDeleteAlertMutation } from "@/lib/queries/titles";
import { formatPrice } from "./title-format";

const DIRECTION_OPTIONS: { value: PriceAlertDirection; label: string }[] = [
  { value: "sopra", label: "Sale sopra" },
  { value: "sotto", label: "Scende sotto" },
];

/** Numero digitato con virgola o punto → numero, o null se non valido. */
export function parseTargetInput(text: string): number | null {
  const value = Number(text.trim().replace(",", "."));
  return text.trim() !== "" && Number.isFinite(value) && value > 0 ? value : null;
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
  const [direction, setDirection] = React.useState<PriceAlertDirection>("sopra");
  const [target, setTarget] = React.useState("");
  const create = useCreateAlertMutation(instrumentId);
  const remove = useDeleteAlertMutation(instrumentId);
  const value = parseTargetInput(target);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (value === null) return;
    create.mutate({ direction, targetPrice: value }, { onSuccess: () => setTarget("") });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Avvisi di prezzo</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
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
                      {ALERT_DIRECTION_LABELS[alert.direction][0].toUpperCase() + ALERT_DIRECTION_LABELS[alert.direction].slice(1)}{" "}
                      <span className="font-medium tabular-nums">{formatPrice(Number(alert.targetPrice), currency)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {triggered && alert.triggeredAt
                        ? `Scattato il ${formatShortDate(new Date(alert.triggeredAt).toISOString().slice(0, 10))} con la chiusura a ${formatPrice(Number(alert.triggeredPrice), currency)}`
                        : "In attesa: controllo ogni sera dopo la chiusura"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Elimina avviso"
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
            {supported ? "Nessun avviso. Ti scrivo per email quando la chiusura raggiunge il livello che scegli." : "Gli avvisi funzionano solo per i titoli con prezzi automatici."}
          </p>
        )}

        {supported ? (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <SegmentedControl options={DIRECTION_OPTIONS} value={direction} onChange={setDirection} ariaLabel="Direzione dell'avviso" stretch />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`alert-target-${instrumentId}`}>Livello ({currency})</Label>
              <div className="flex gap-2">
                <Input
                  id={`alert-target-${instrumentId}`}
                  inputMode="decimal"
                  placeholder={lastClose !== null ? `Ultima chiusura ${formatPrice(lastClose, currency)}` : "Prezzo"}
                  value={target}
                  onChange={(event) => setTarget(event.target.value)}
                  aria-invalid={target.trim() !== "" && value === null}
                />
                <Button type="submit" disabled={value === null || create.isPending}>
                  Crea avviso
                </Button>
              </div>
            </div>
            {create.isError ? (
              <p role="alert" className="text-sm text-destructive">
                {create.error.message}
              </p>
            ) : null}
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
