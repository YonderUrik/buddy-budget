"use client";
import { germanCrypto, type GermanPlan } from "@/lib/financial-planning";
import { useLocalization } from "@/lib/localization/provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NumberField, Panel, Result } from "./fields";
/** Private crypto lot scenarios, separate from capital income taxation and loss baskets. */
export function CryptoEditor({ plan, onChange }: { plan: GermanPlan; onChange: (plan: GermanPlan) => void }) {
  const { t } = useLocalization(); const result = germanCrypto(plan);
  const update = (id: string, patch: Partial<GermanPlan['crypto'][number]>) => onChange({ ...plan, crypto: plan.crypto.map(s => s.id === id ? { ...s, ...patch } : s) });
  return <Panel title="Private crypto sales · 2026">
    <p className="text-sm text-muted-foreground">{t("Enter matched acquisition/disposal lots in EUR, including crypto-to-crypto exchanges. More than one year is exempt; the annual €1,000 private-sale threshold is not a deduction. Business trading, staking rewards, lending, mining, NFTs and derivatives need separate treatment. This scenario is not imported automatically from the portfolio.")}</p>
    {plan.crypto.map(s => <fieldset key={s.id} className="space-y-3 rounded-lg bg-muted/50 p-4"><legend>{s.name}</legend>
      <label className="block text-sm">{t("Name")}<Input value={s.name} onChange={e => update(s.id, { name: e.target.value })} /></label>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">{t("Acquisition date")}<Input type="date" value={s.acquired} onChange={e => update(s.id, { acquired: e.target.value })} /></label><label className="text-sm">{t("Sale date")}<Input type="date" min="2026-01-01" max="2026-12-31" value={s.sold} onChange={e => update(s.id, { sold: e.target.value })} /></label>
      <NumberField label="Sale proceeds (€)" value={s.proceeds} onChange={v => update(s.id, { proceeds: v })} /><NumberField label="Acquisition cost (€)" value={s.cost} onChange={v => update(s.id, { cost: v })} /><NumberField label="Disposal fees (€)" value={s.fees} onChange={v => update(s.id, { fees: v })} /></div>
      <Button type="button" variant="outline" onClick={() => onChange({ ...plan, crypto: plan.crypto.filter(x => x.id !== s.id) })}>{t("Remove sale")}</Button>
    </fieldset>)}
    <Button type="button" variant="outline" onClick={() => onChange({ ...plan, crypto: [...plan.crypto, { id: crypto.randomUUID(), name: t("Crypto sale"), acquired: "2026-01-01", sold: "2026-10-14", proceeds: 0, cost: 0, fees: 0 }] })}>{t("Add sale")}</Button>
    <div className="grid gap-4 sm:grid-cols-2"><NumberField label="Other private-sale gains or losses (€)" min={-1e12} value={plan.cryptoOtherGains} onChange={v => onChange({ ...plan, cryptoOtherGains: v })} /><NumberField label="Private-sale loss carryforward (€)" value={plan.cryptoLossCarryforward} onChange={v => onChange({ ...plan, cryptoLossCarryforward: v })} /><NumberField label="Other taxable income, not gross salary (€)" value={plan.otherTaxableIncome} onChange={v => onChange({ ...plan, otherTaxableIncome: v })} /></div>
    <Result label="Short-term net gains" value={result.shortTerm} /><Result label="Long-term exempt gains" value={result.exempt} /><Result label="Taxable private-sale gains" value={result.taxable} /><Result label="Additional income tax (before surcharges)" value={result.incomeTax} />
    <p className="text-sm text-muted-foreground">{t("Progressive 2026 income-tax scenario using the assessment selected above. Solidarity surcharge, church tax, loss carryback and personal deductions are not included.")}</p>
  </Panel>;
}
