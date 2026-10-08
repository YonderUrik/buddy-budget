"use client";

/**
 * Card "Prima di vendere": scegli una posizione e quante quote, e vedi plus/minusvalenza, zaino usato o generato,
 * imposte in più (o in meno) quest'anno e quanto ti resta. Stesse regole del calcolo per anno.
 */

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { InvestmentTransactionInput } from "@/lib/calc/investments";
import { simulateSale, type ManualLossInput, type TaxCategory, type TaxInstrument } from "@/lib/calc/taxes";
import type { TaxRegime } from "@/lib/db/schema/investments";
import { formatCurrency } from "@/lib/format";
import type { SellablePosition } from "@/lib/investments/tax-view";
import { parseAmount } from "@/lib/validation/accounts";
import { formatSignedCurrency } from "../gain-text";
import { OperationFormField as Field } from "../operation-form-field";
import { CalculatorIcon } from "lucide-react";
import { PanelSection } from "../panel-section";

const CATEGORY_TEXT: Record<TaxCategory, string> = {
  diversi: "Reddito diverso: compensabile con lo zaino.",
  capitale: "Guadagno di un ETF o fondo: reddito di capitale, tassato per intero anche se hai minusvalenze.",
  crypto: "Crypto: si dichiara a parte e si compensa solo con altre crypto.",
};

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
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={strong ? "font-semibold tabular-nums text-foreground" : "tabular-nums text-foreground"}>{value}</dd>
    </div>
  );
}

export function SaleSimulatorCard({ positions, transactions, instruments, regime, manualLosses, todayKey, currency }: SaleSimulatorCardProps) {
  const id = React.useId();
  const priced = positions.filter((p) => p.price !== null && p.fxRate !== null);
  const [instrumentId, setInstrumentId] = React.useState(priced[0]?.instrument.id ?? "");
  const position = priced.find((p) => p.instrument.id === instrumentId) ?? priced[0];
  const [quantityText, setQuantityText] = React.useState<string | null>(null);
  if (!position) return null;
  const quantityValue = quantityText === null ? position.quantity : parseAmount(quantityText);
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
    <PanelSection icon={CalculatorIcon} title="Prima di vendere" color="var(--swatch-indigo)">
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
          <Field label="Posizione">
            <Select
              value={position.instrument.id}
              onValueChange={(v) => {
                if (!v) return;
                setInstrumentId(v);
                setQuantityText(null);
              }}
            >
              <SelectTrigger className="w-full" aria-label="Posizione da vendere">
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
          <Field label={`Quote (di ${position.quantity.toLocaleString("it-IT", { maximumFractionDigits: 4 })})`} htmlFor={`${id}-qty`}>
            <Input
              id={`${id}-qty`}
              inputMode="decimal"
              value={quantityText ?? String(position.quantity).replace(".", ",")}
              onChange={(e) => setQuantityText(e.target.value)}
            />
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">
          All&apos;ultimo prezzo ({formatCurrency(position.price!, position.instrument.currency)}
          {position.instrument.priceUnit === "percentuale_nominale" ? " ogni 100 di nominale" : ""}), senza commissioni.
        </p>
        {result ? (
          <>
            <dl className="divide-y divide-border">
              <Line label="Incasso" value={format(result.proceeds)} />
              <Line label="Costo fiscale (prezzo medio)" value={format(result.cost)} />
              <Line label={result.gain >= 0 ? "Plusvalenza" : "Minusvalenza"} value={formatSignedCurrency(result.gain, currency)} />
              {result.lossesUsed > 0 ? <Line label="Zaino usato" value={format(result.lossesUsed)} /> : null}
              {result.lossesCreated > 0 ? <Line label="Nuovo zaino" value={format(result.lossesCreated)} /> : null}
              <Line
                label={result.taxDelta < 0 ? "Imposte in meno quest'anno" : regime === "amministrato" ? "Imposte trattenute" : "Imposte in più in dichiarazione"}
                value={format(Math.abs(result.taxDelta))}
              />
              <Line label="Ti resta" value={format(result.net)} strong />
            </dl>
            <p className="text-sm text-muted-foreground">
              {CATEGORY_TEXT[result.category]}
              {result.nonHarmonized ? " ETF non armonizzato: in realtà a IRPEF, qui stimato al 26%." : ""}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Inserisci quante quote vuoi vendere.</p>
        )}
      </div>
    </PanelSection>
  );
}
