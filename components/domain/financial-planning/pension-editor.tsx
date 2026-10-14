"use client";
import { projectGermanPension, pensionPlanSchema, pensionKinds, type GermanPlan, type PensionPlan } from "@/lib/financial-planning";
import { useLocalization } from "@/lib/localization/provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NumberField, Choice, Panel, Result } from "./fields";
const KINDS = { statutory: "Statutory pension (GRV)", occupational: "Occupational pension (bAV)", riester: "Riester pension", ruerup: "Basis pension (Rürup)", private: "Private pension", avd: "Altersvorsorgedepot (AVD)" };
/** Track capital and future pension entitlements separately, with product-specific gross projections. */
export function PensionEditor({ plan, onChange }: { plan: GermanPlan; onChange: (plan: GermanPlan) => void }) {
  const { t } = useLocalization();
  const update = (id: string, patch: Partial<PensionPlan>) => onChange({ ...plan, pensions: plan.pensions.map(p => p.id === id ? { ...p, ...patch } : p) });
  return <>
    <Panel title="German pensions">
      <p className="text-sm text-muted-foreground">{t("Track statutory, occupational, Riester, Rürup, private pensions and Altersvorsorgedepots separately. Pension entitlements are future income, not liquid assets. Contract capital is shown only here and is not added automatically to your portfolio or net worth.")}</p>
      <p className="text-sm text-muted-foreground">{t("Use provider statements for contributions, contract value, payment date and gross pension. Projections are before income tax, health and care contributions. Subsidies, tax deductions, guarantees, surrender values and eligibility are not inferred.")}</p>
      {plan.pensions.length === 0 && <p>{t("Add your first pension from its latest statement.")}</p>}
      <Button type="button" variant="outline" onClick={() => onChange({ ...plan, pensions: [...plan.pensions, pensionPlanSchema.parse({ id: crypto.randomUUID(), name: t("My pension"), kind: "statutory" })] })}>{t("Add pension")}</Button>
    </Panel>
    {plan.pensions.map(p => { const result = projectGermanPension(p); return <Panel title={p.name} literalTitle key={p.id}>
      {p.kind === 'avd' && <p className="text-sm text-muted-foreground">{t("Altersvorsorgedepot: new contracts from 2027. This is a gross planning scenario, not an available 2026 account. Enter contributions and returns explicitly; subsidies, tax relief and payout taxation are not calculated. Keep this capital separate from liquid investments. Payout-plan duration and partial lump sums are not modelled yet.")}</p>}
      <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">{t("Name")}<Input value={p.name} maxLength={100} onChange={e => update(p.id, { name: e.target.value })} /></label>
        <Choice label="Pension type" value={p.kind} options={pensionKinds.map(value => ({ value, label: KINDS[value] }))} onChange={v => update(p.id, { kind: v as PensionPlan['kind'], paymentMode: v === 'ruerup' || v === 'statutory' || v === 'riester' || v === 'avd' ? 'income' : p.paymentMode })} />
        <NumberField label="Years until payment starts" value={p.yearsUntilPayment} max={80} step={1} onChange={v => update(p.id, { yearsUntilPayment: v })} />
        {p.kind === 'statutory' ? <><NumberField label="Accrued pension points" value={p.points} onChange={v => update(p.id, { points: v })} /><NumberField label="Assumed additional points per year" value={p.annualPoints} onChange={v => update(p.id, { annualPoints: v })} /><NumberField label="Access factor from your pension statement" value={p.accessFactor} max={2} step={0.001} onChange={v => update(p.id, { accessFactor: v })} /></> : <>
          <NumberField label="Current contract capital (€)" value={p.capital} onChange={v => update(p.id, { capital: v })} /><NumberField label="Monthly total contribution (€)" value={p.monthlyContribution} onChange={v => update(p.id, { monthlyContribution: v })} /><NumberField label="Assumed annual return after costs (%)" value={p.nominalReturn * 100} min={-50} max={30} onChange={v => update(p.id, { nominalReturn: v / 100 })} />
          {p.kind !== 'ruerup' && p.kind !== 'riester' && p.kind !== 'avd' && <Choice label="Retirement payout used in the plan" value={p.paymentMode} options={[{ value: 'income', label: 'Monthly income' }, { value: 'capital', label: 'Contractually available lump sum' }]} onChange={v => update(p.id, { paymentMode: v as PensionPlan['paymentMode'] })} />}
          {p.paymentMode === 'income' && <NumberField label="Expected monthly gross pension from provider (€)" value={p.monthlyGross} onChange={v => update(p.id, { monthlyGross: v })} />}
        </>}
      </div>
      {p.kind === 'statutory' ? <p className="text-sm text-muted-foreground">{t("Old-age pension: points × access factor × €42.52, the pension value from July 2026. Future pension-value increases and eligibility are not assumed.")}</p> : <Result label="Projected contract capital" value={result.projectedCapital} />}
      <Result label="Projected monthly gross pension" value={result.monthlyGross} />
      <Button type="button" variant="outline" onClick={() => onChange({ ...plan, pensions: plan.pensions.filter(x => x.id !== p.id) })}>{t("Remove pension")}</Button>
    </Panel>; })}
  </>;
}
