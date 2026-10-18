"use client";

import { localizedFormats, numberSeparators } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";

/**
 * Card "Prima di vendere": scegli una posizione e quante quote, e vedi plus/minusvalenza, zaino usato o generato,
 * imposte in più (o in meno) quest'anno e quanto ti resta. Stesse regole del calcolo per anno.
 */

import * as React from "react";
import { SimulationResult } from "@/components/domain/shared";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { InvestmentTransactionInput } from "@/lib/calc/investments";
import { simulateSale, type ManualLossInput, type TaxInstrument } from "@/lib/calc/taxes";
import type { TaxRegime } from "@/lib/db/schema/investments";

import type { SellablePosition } from "@/lib/investments/tax-view";
import { SALE_CATEGORY_TEXT, SALE_NON_HARMONIZED_TEXT, saleTaxLineLabel } from "@/lib/investments/sale-simulation-text";
import { parseAmount } from "@/lib/validation/accounts";

import { OperationFormField as Field } from "../operation-form-field";
import { CalculatorIcon } from "lucide-react";
import { PanelSection } from "../panel-section";


export interface SaleSimulatorCardProps {
  positions: SellablePosition[];
  transactions: InvestmentTransactionInput[];
  instruments: TaxInstrument[];
  regime: TaxRegime;
  manualLosses: ManualLossInput[];
  todayKey: string;
  currency: string;
}

function Line({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  const { t: tr } = useLocalization();
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
      <dt className="text-muted-foreground">{tr(label)}</dt>
      <dd className={strong ? "font-semibold tabular-nums text-foreground" : "tabular-nums text-foreground"}>{value}</dd>
    </div>
  );
}

export function SaleSimulatorCard({ positions, transactions, instruments, regime, manualLosses, todayKey, currency }: SaleSimulatorCardProps) {
  const { locale: formattingLocale } = useLocalization();
  const { formatSignedCurrency } = localizedFormats(formattingLocale);


  const { formatCurrency } = localizedFormats(formattingLocale);

  const { t: tr } = useLocalization();
  const id = React.useId();
  const priced = positions.filter((p) => p.price !== null && p.fxRate !== null);
  const [instrumentId, setInstrumentId] = React.useState(priced[0]?.instrument.id ?? "");
  const position = priced.find((p) => p.instrument.id === instrumentId) ?? priced[0];
  const [quantityText, setQuantityText] = React.useState<string | null>(null);
  if (!position) return null;
  const quantityValue = quantityText === null ? position.quantity : parseAmount(quantityText, formattingLocale);
  const quantity = quantityValue !== null ? Math.min(quantityValue, position.quantity) : null;
  const result =
    quantity !== null && quantity > 0
      ? simulateSale({
          transactions,
          instruments,
          regime,
          manualLosses,
          todayKey,
          instrumentId: position.instrument.id,
          quantity,
          price: position.price!,
          fxRate: position.fxRate!,
        })
      : null;
  const format = (amount: number) => formatCurrency(amount, currency);

  return (
    <PanelSection icon={CalculatorIcon} title={tr("Prima di vendere")} color="var(--swatch-indigo)">
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
          <Field label={tr("Posizione")}>
            <Select
              value={position.instrument.id}
              onValueChange={(v) => {
                if (!v) return;
                setInstrumentId(v);
                setQuantityText(null);
              }}
            >
              <SelectTrigger className="w-full" aria-label={tr("Posizione da vendere")}>
                <SelectValue>{(v: string | null) => priced.find((p) => p.instrument.id === v)?.instrument.name ?? ""}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {priced.map((p) => (
                  <SelectItem key={p.instrument.id} value={p.instrument.id}>
                    {p.instrument.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={tr("Quote (di {0})", {0: position.quantity.toLocaleString(formattingLocale, { maximumFractionDigits: 4 })})} htmlFor={`${id}-qty`}>
            <Input
              id={`${id}-qty`}
              inputMode="decimal"
              value={quantityText ?? String(position.quantity).replace(".", numberSeparators(formattingLocale).decimal)}
              onChange={(e) => setQuantityText(e.target.value)}
            />
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">{tr("All'ultimo prezzo (")}{formatCurrency(position.price!, position.instrument.currency)}
          {position.instrument.priceUnit === "percentuale_nominale" ? tr(" ogni 100 di nominale") : ""}{tr("), senza commissioni.")}</p>
        {result ? (
          <>
            <SimulationResult label={tr("Ti resta")} value={format(result.net)} />
            <dl>
              <Line label={tr("Incasso")} value={format(result.proceeds)} />
              <Line label={tr("Costo fiscale (prezzo medio)")} value={format(result.cost)} />
              <Line label={result.gain >= 0 ? tr("Plusvalenza") : tr("Minusvalenza")} value={formatSignedCurrency(result.gain, currency)} />
              {result.lossesUsed > 0 ? <Line label={tr("Zaino usato")} value={format(result.lossesUsed)} /> : null}
              {result.lossesCreated > 0 ? <Line label={tr("Nuovo zaino")} value={format(result.lossesCreated)} /> : null}
              <Line
                label={tr(saleTaxLineLabel(result, regime))}
                value={format(Math.abs(result.taxDelta))}
              />
            </dl>
            <p className="text-sm text-muted-foreground">
              {tr(SALE_CATEGORY_TEXT[result.category])}
              {result.nonHarmonized ? tr(SALE_NON_HARMONIZED_TEXT) : ""}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{tr("Inserisci quante quote vuoi vendere.")}</p>
        )}
      </div>
    </PanelSection>
  );
}
