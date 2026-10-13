"use client";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";

/**
 * Card "Zaino delle minusvalenze": quanto puoi ancora compensare e fino a quando, per anno di scadenza, e le
 * minusvalenze pregresse (lo zaino che il broker aveva prima dell'app) da aggiungere o togliere.
 */

import * as React from "react";
import { Trash2Icon } from "lucide-react";
import { InfoHint } from "@/components/domain/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lossesByExpiry, type LossEntry } from "@/lib/calc/taxes";

import type { InvestmentData } from "@/lib/investments/data";
import { useCreateTaxCarryforwardMutation, useDeleteTaxCarryforwardMutation } from "@/lib/queries/investments";
import { parseAmount } from "@/lib/validation/accounts";
import { BackpackIcon } from "lucide-react";
import { PanelSection } from "../panel-section";

export interface LossCarryforwardCardProps {
  losses: LossEntry[];
  carryforwards: InvestmentData["taxCarryforwards"];
  currency: string;
  currentYear: number;
}

function AddCarryforwardForm({ currency, currentYear, onDone }: { currency: string; currentYear: number; onDone: () => void }) {
  const { t: tr } = useLocalization();
  const id = React.useId();
  const create = useCreateTaxCarryforwardMutation();
  const [year, setYear] = React.useState(String(currentYear - 1));
  const [amount, setAmount] = React.useState("");
  const [note, setNote] = React.useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = parseAmount(amount);
    if (!value || value <= 0) return;
    create.mutate({ year: Number(year), amount: value, note: note.trim() || null }, { onSuccess: onDone });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-lg bg-muted/60 p-3">
      <div className="grid grid-cols-[6rem_1fr] gap-2">
        <Input id={`${id}-year`} inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} aria-label={tr("Anno in cui è nata")} />
        <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={tr("Importo ({0})", {0: currency})} aria-label={tr("Importo")} />
      </div>
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr("Nota (facoltativa)")} aria-label={tr("Nota")} />
      <p className="text-xs text-muted-foreground">{tr("Usa il residuo dello zaino che vedi nel rendiconto fiscale del broker, con l'anno in cui è nato.")}</p>
      {create.isError ? <p className="text-sm text-destructive">{tr(create.error.message)}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={create.isPending}>{tr("Aggiungi")}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>{tr("Annulla")}</Button>
      </div>
    </form>
  );
}

export function LossCarryforwardCard({ losses, carryforwards, currency, currentYear }: LossCarryforwardCardProps) {
  const { locale: formattingLocale } = useLocalization();
  const { formatCurrency } = localizedFormats(formattingLocale);

  const { t: tr } = useLocalization();
  const [adding, setAdding] = React.useState(false);
  const remove = useDeleteTaxCarryforwardMutation();
  const byExpiry = lossesByExpiry(losses);
  const cryptoByExpiry = lossesByExpiry(losses, true);
  const total = byExpiry.reduce((s, e) => s + e.amount, 0);
  const max = Math.max(...byExpiry.map((e) => e.amount), 0);
  const format = (amount: number) => formatCurrency(amount, currency, { maximumFractionDigits: 0 });

  return (
    <PanelSection icon={BackpackIcon} title={tr("Zaino delle minusvalenze")} color="var(--swatch-indigo)"
      action={
        <InfoHint label={tr("Cos'è lo zaino")}>{tr("Le minusvalenze di un anno si possono usare fino al 31 dicembre del quarto anno dopo, per non pagare tasse sulle plusvalenze di azioni, obbligazioni ed ETC (non sui guadagni degli ETF). Gli importi sono portati all'aliquota del 26%.")}</InfoHint>
      }>
      <div className="flex flex-col gap-4">
        <p className="max-w-prose text-base text-foreground">
          {total > 0 ? (
            <>{tr("Puoi ancora compensare")}{" "}<span className="font-semibold tabular-nums">{format(total)}</span>{" "}{tr("di plusvalenze.")}</>
          ) : (
            "Lo zaino è vuoto: nessuna minusvalenza da compensare."
          )}
        </p>
        {byExpiry.length > 0 ? (
          <ul className="flex flex-col gap-2" aria-label={tr("Zaino per anno di scadenza")}>
            {byExpiry.map((entry) => (
              <li key={entry.expiresYear} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-3 text-sm">
                <span className={entry.expiresYear === currentYear ? "font-medium text-neg" : "text-muted-foreground"}>{tr("Scade fine")}{" "}{entry.expiresYear}
                </span>
                <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${max > 0 ? (entry.amount / max) * 100 : 0}%` }} />
                </span>
                <span className="tabular-nums text-foreground">{format(entry.amount)}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {cryptoByExpiry.length > 0 ? (
          <p className="text-sm text-muted-foreground">{tr("Zaino crypto (compensabile solo con crypto):")}{" "}{format(cryptoByExpiry.reduce((s, e) => s + e.amount, 0))}.
          </p>
        ) : null}
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <p className="text-xs font-medium text-muted-foreground">{tr("Minusvalenze pregresse")}</p>
          {carryforwards.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {carryforwards.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-foreground">
                    {c.year} · <span className="tabular-nums">{formatCurrency(Number(c.amount), currency)}</span>
                    {c.note ? <span className="text-muted-foreground"> · {c.note}</span> : null}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={tr("Elimina la minusvalenza del {0}", {0: c.year})}
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(c.id)}
                  >
                    <Trash2Icon aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{tr("Se il broker aveva già minusvalenze da prima dell'app, aggiungile qui.")}</p>
          )}
          {adding ? (
            <AddCarryforwardForm currency={currency} currentYear={currentYear} onDone={() => setAdding(false)} />
          ) : (
            <Button variant="outline" size="sm" className="self-start" onClick={() => setAdding(true)}>{tr("Aggiungi minusvalenza pregressa")}</Button>
          )}
        </div>
      </div>
    </PanelSection>
  );
}
