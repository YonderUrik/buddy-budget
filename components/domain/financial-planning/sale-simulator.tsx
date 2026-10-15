"use client";
import { useState } from "react";
import { germanPortfolioReport } from "@/lib/financial-planning";
import { useLocalization } from "@/lib/localization/provider";
import { track } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { NumberField, Choice, Panel, Result } from "./fields";
import type { PlanEditorProps } from "./tax-editor";

/** Hypothetical disposal uses the same depot FIFO engine without writing a portfolio transaction. */
export function SaleSimulator({ plan, data }: PlanEditorProps) {
  const { t } = useLocalization();
  const choices = data.instruments.filter(i => ["azione", "etf", "fondo", "obbligazione"].includes(i.type));
  const [instrumentId, setInstrument] = useState(choices[0]?.id ?? "");
  const sources = [...new Map(data.transactions.filter(tx => tx.instrumentId === instrumentId).map(tx => [`${tx.portfolioId}:${tx.statementAccountKey ?? "manual"}`, tx])).entries()];
  const [sourceKey, setSource] = useState("");
  const source = sources.find(([key]) => key === sourceKey)?.[1] ?? sources[0]?.[1];
  const [quantity, setQuantity] = useState(0), [price, setPrice] = useState(0), [fees, setFees] = useState(0), [fx, setFx] = useState(1), [advances, setAdvances] = useState(0);
  const [result, setResult] = useState<{ change: number | null; gain: number | null } | null>(null);
  const instrument = choices.find(i => i.id === instrumentId);
  const change = (setter: (n: number) => void) => (n: number) => { setter(n); setResult(null); };
  function simulate() {
    if (!source || quantity <= 0 || fx <= 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const baseline = germanPortfolioReport(data, plan.tax, today);
    const simulated = { ...source, id: "simulated-sale", type: "vendita" as const, date: today, quantity: String(quantity), price: String(price), fees: String(fees), fxRate: String(fx), taxes: "0", grossAmount: null, createdAt: new Date(), updatedAt: new Date() };
    const after = germanPortfolioReport({ ...data, transactions: [...data.transactions, simulated] }, { ...plan.tax, priorAdvancesBySale: { ...plan.tax.priorAdvancesBySale, [simulated.id]: advances } }, today);
    setResult({ change: baseline.estimate && after.estimate ? after.estimate.total - baseline.estimate.total : null, gain: after.events.find(e => e.id === simulated.id)?.gain ?? null });
    track("financial_sale_simulated", { country: "DE" });
  }
  if (!choices.length) return null;
  return <Panel title="Before you sell">
    <p className="text-sm text-muted-foreground">{t("Simulate a sale using the same German tax settings and custody-account FIFO lots. No operation is saved. Complete the tax information above first.")}</p>
    <div className="grid gap-4 sm:grid-cols-2"><Choice label="Instrument" value={instrumentId} options={choices.map(i => ({ value: i.id, label: i.name }))} onChange={v => { setInstrument(v); setSource(""); setResult(null); }} />
      <Choice label="Custody account" value={source ? `${source.portfolioId}:${source.statementAccountKey ?? "manual"}` : ""} options={sources.map(([value, tx]) => ({ value, label: `${data.portfolios.find(p => p.id === tx.portfolioId)?.name ?? t('Account')} · ${tx.statementAccountKey ? `${data.brokerSources?.find(s => s.accountKey === tx.statementAccountKey)?.provider ?? t('Imported account')} · ${tx.statementAccountKey.slice(-6)}` : t('Manual entries')}` }))} onChange={v => { setSource(v); setResult(null); }} />
      <NumberField label="Units / bond nominal" value={quantity} step={0.000001} onChange={change(setQuantity)} /><NumberField label={instrument?.priceUnit === 'percentuale_nominale' ? 'Sale price (% of nominal)' : t('Sale price ({0})', { 0: instrument?.currency ?? 'EUR' })} value={price} onChange={change(setPrice)} />
      <NumberField label="Exchange rate to EUR" value={fx} min={0.000001} step={0.000001} onChange={change(setFx)} /><NumberField label="Disposal fees (€)" value={fees} onChange={change(setFees)} /><NumberField label="Prior gross advances (€)" value={advances} onChange={change(setAdvances)} />
    </div>
    <Button type="button" disabled={!source || quantity <= 0 || fx <= 0} onClick={simulate}>{t("Simulate sale")}</Button>
    {result && <div role="status"><Result label="Simulated realised gain" value={result.gain} /><Result label="Change in estimated annual tax" value={result.change} /></div>}
  </Panel>;
}
