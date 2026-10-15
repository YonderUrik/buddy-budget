"use client";
import { germanAvdTaxBenefit, type PensionPlan } from "@/lib/financial-planning";
import { useLocalization } from "@/lib/localization/provider";
import { NumberField, Choice, Result } from "./fields";

/** AVD assumptions and benefits remain explicit and persisted with this contract. */
export function AvdEditor({ pension, joint, referenceYear, onChange }: { pension: PensionPlan; joint: boolean; referenceYear: number; onChange: (patch: Partial<PensionPlan>) => void }) {
  const { t } = useLocalization(), a = pension.avd;
  const update = (patch: Partial<typeof a>) => {
    const avd = { ...a, ...patch };
    onChange({ avd, ...(avd.enabled ? { yearsUntilPayment: Math.max(0, avd.payoutStartAge - avd.ageAtStart + avd.contributionStartYear - referenceYear) } : {}) });
  };
  const result = germanAvdTaxBenefit(pension, joint);
  return <div className="space-y-4">
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={a.enabled} onChange={e => update({ enabled: e.target.checked })} />{t("Calculate AVD grants and payouts")}</label>
    {a.enabled && <>
      <p className="text-sm text-muted-foreground">{t("AVD rules start in 2027. Contributions begin in the selected year; grants are credited at year-end. Confirm eligibility and allocate child allowances to one parent only. Returns are assumptions, not guarantees.")}</p>
      <p className="text-sm text-muted-foreground">{t("Use one combined AVD scenario per person to avoid duplicate allowances. Payout must start after the first contribution year.")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField label="Contribution start year" value={a.contributionStartYear} min={2027} max={2100} step={1} onChange={v => update({ contributionStartYear: v })} />
        <Choice label="Confirmed grant eligibility" value={a.eligibility} options={[{ value: "none", label: "No confirmed entitlement" }, { value: "direct", label: "Direct entitlement" }, { value: "indirect", label: "Indirect entitlement through spouse" }]} onChange={v => update({ eligibility: v as typeof a.eligibility })} />
        {a.eligibility === "indirect" && <NumberField label="Eligible spouse's annual contribution (€)" value={a.spouseAnnualContribution} max={6840} onChange={v => update({ spouseAnnualContribution: v })} />}
        <NumberField label="Age at contribution start" value={a.ageAtStart} min={18} max={100} step={1} onChange={v => update({ ageAtStart: v })} />
        <NumberField label="Children allocated to this contract" value={a.childAllowanceYears.length} max={20} step={1} onChange={v => update({ childAllowanceYears: Array.from({ length: v }, (_, i) => a.childAllowanceYears[i] ?? 1) })} />
        {a.childAllowanceYears.map((years, index) => <NumberField key={index} label={t("Remaining allowance years for child {0}", { 0: index + 1 })} value={years} max={30} step={1} onChange={v => update({ childAllowanceYears: a.childAllowanceYears.map((n, i) => i === index ? v : n) })} />)}
        <NumberField label="Taxable household income before AVD deduction (€)" value={a.taxableIncomeBeforeDeduction} onChange={v => update({ taxableIncomeBeforeDeduction: v })} />
        <Choice label="AVD payout method" value={a.payout} options={[{ value: "provider", label: "Lifetime pension from provider statement" }, { value: "drawdown", label: "Fixed-term drawdown" }]} onChange={v => update({ payout: v as typeof a.payout })} />
        <NumberField label="Age when payouts start" value={a.payoutStartAge} min={65} max={70} step={1} onChange={v => update({ payoutStartAge: v })} />
        <NumberField label="Initial lump sum (%)" value={a.lumpSumRate * 100} max={30} onChange={v => update({ lumpSumRate: v / 100 })} />
        {a.payout === "drawdown" && <><NumberField label="Age when payouts end" value={a.payoutEndAge} min={85} max={120} step={1} onChange={v => update({ payoutEndAge: v })} /><NumberField label="Annual return during payouts (%)" value={a.payoutReturn * 100} min={-50} max={30} onChange={v => update({ payoutReturn: v / 100 })} /></>}
      </div>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={a.starterBonus} onChange={e => update({ starterBonus: e.target.checked })} />{t("Starter bonus entitlement confirmed and not previously used")}</label>
      <Result label="First-year basic grant" value={result.base} /><Result label="First-year child grants" value={result.children} /><Result label="One-time starter bonus" value={result.bonus} />
      <Result label="Additional tax refund · 2026 tariff comparison" value={result.extraRefund} />
      <p className="text-sm text-muted-foreground">{t("The tax comparison holds the 2026 income-tax tariff constant; it is not a 2027 tax assessment. Grants are deducted from the tax benefit to avoid double counting. Refunds are not reinvested automatically. For indirect entitlement, the spouse's joint deduction must be assessed separately.")}</p>
      <p className="text-sm text-muted-foreground">{t("A fixed-term payout ends at the selected age and then contributes no pension income. For a lifetime payout, enter the provider's amount after the chosen lump sum. Payments from mixed funded and unfunded contributions require the taxable amount from the provider statement.")}</p>
    </>}
  </div>;
}
