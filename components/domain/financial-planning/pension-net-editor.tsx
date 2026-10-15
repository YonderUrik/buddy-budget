"use client";
import { germanPensionNet, projectGermanPension, type GermanPlan } from "@/lib/financial-planning";
import { useLocalization } from "@/lib/localization/provider";
import { NumberField, Choice, Panel, Result } from "./fields";

/** Reusable net-pension controls shared by pension and retirement screens. */
export function PensionNetEditor({ plan, onChange }: { plan: GermanPlan; onChange: (plan: GermanPlan) => void }) {
  const { t } = useLocalization(), settings = plan.pensionTax;
  const update = (patch: Partial<typeof settings>) => onChange({ ...plan, pensionTax: { ...settings, ...patch } });
  const year = plan.retirement.yearsUntilRetirement;
  const net = germanPensionNet(plan.pensions.map(p => {
    const projection = projectGermanPension(p, plan.tax.year);
    return { plan: p, annual: p.yearsUntilPayment <= year && (projection.paymentYears === null || year < p.yearsUntilPayment + projection.paymentYears) ? projection.monthlyGross * 12 : 0,
      lumpSum: p.yearsUntilPayment === year ? projection.lumpSum : 0,
      occupationalMonthlyEquivalent: p.yearsUntilPayment <= year && year < p.yearsUntilPayment + 10 ? projection.lumpSum / 120 : 0 };
  }), plan);
  return <Panel title="Pension taxes and health insurance">
    <Choice label="Net pension calculation" value={settings.mode} options={[{ value: "manual", label: "Manual deduction assumption" }, { value: "rules", label: "German rules · constant 2026 benchmark" }]} onChange={v => update({ mode: v as typeof settings.mode })} />
    {settings.mode === "rules" && <>
      <p className="text-sm text-muted-foreground">{t("This projection applies the 2026 tax tariff and insurance thresholds unchanged to future years. Pension taxable shares follow the start-year schedule. Enter pensions for one insured person; joint assessment uses combined other taxable income. Special occupational arrangements require an individual calculation.")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Choice label="Health insurance in retirement" value={settings.insurance} options={[{ value: "kvdr", label: "Compulsory pensioner insurance (KVdR)" }, { value: "voluntary", label: "Voluntary statutory insurance" }, { value: "private", label: "Private insurance · actual net premium" }]} onChange={v => update({ insurance: v as typeof settings.insurance })} />
        <NumberField label="Other annual taxable income (€)" value={settings.otherTaxableIncome} onChange={v => update({ otherTaxableIncome: v })} />
        <NumberField label="Annual child allowances for surcharge calculation (€)" value={settings.surchargeChildAllowance} onChange={v => update({ surchargeChildAllowance: v })} />
        <NumberField label="Other annual deductions not already included (€)" value={settings.otherDeductions} onChange={v => update({ otherDeductions: v })} />
        {settings.insurance !== "private" ? <>
          {settings.insurance === "voluntary" && <>
            <NumberField label="Other annual income assessed for health insurance (€)" value={settings.otherInsuranceIncome} onChange={v => update({ otherInsuranceIncome: v })} />
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={settings.voluntarySubsidy} onChange={e => update({ voluntarySubsidy: e.target.checked })} />{t("Statutory pension health-insurance subsidy confirmed")}</label>
            <p className="text-sm text-muted-foreground">{t("Voluntary insurance includes private pensions and other assessed income, with 2026 minimum and maximum bases and no occupational exemption. Enter assessed rental and capital income, not total withdrawals. Private lump sums, employment, spouse-income attribution and special income types need an insurer calculation.")}</p>
          </>}
          <NumberField label="Health insurer additional contribution (%)" value={settings.additionalHealthRate * 100} max={10} onChange={v => update({ additionalHealthRate: v / 100 })} />
          <NumberField label="Children under 25 for care insurance" value={settings.childrenUnder25} max={20} step={1} onChange={v => update({ childrenUnder25: v, childless: v > 0 ? false : settings.childless })} />
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={settings.childless} onChange={e => update({ childless: e.target.checked, childrenUnder25: e.target.checked ? 0 : settings.childrenUnder25 })} />{t("Childless care-insurance surcharge applies")}</label>
        </> : <><NumberField label="Annual private health and care premium after subsidies (€)" value={settings.annualPrivatePremium} onChange={v => update({ annualPrivatePremium: v })} /><NumberField label="Tax-deductible part of that premium (€)" value={settings.annualDeductiblePremium} max={settings.annualPrivatePremium} onChange={v => update({ annualDeductiblePremium: v })} /></>}
      </div>
      <p className="text-sm text-muted-foreground">{t("Assessment and church-tax settings come from Taxes. Church tax is estimated before its special-expense deduction. Child allowances entered here affect surcharge calculations only. Pension income is taxed together, with one expense allowance and one occupational health exemption.")}</p>
      <h3>{t("First retirement year · annual nominal amounts")}</h3>
      {net.insuranceIssues.length > 0 && <p role="alert">{t("Private lump-sum payments require an insurer contribution assessment in voluntary insurance. Set the lump sum to zero to compare recurring payments only.")}</p>}
      {net.issues.length > 0 && net.insuranceIssues.length === 0 && <p role="alert">{t("Confirm tax treatment or enter the taxable amount from the provider for every pension before showing net results.")}</p>}
      <Result label="Gross pension payments" value={net.gross} /><Result label="Taxable pension payments" value={net.taxable} /><Result label="Health insurance contributions" value={net.health} /><Result label="Care insurance contributions" value={net.care} /><Result label="Additional income tax" value={net.incomeTax} /><Result label="Solidarity surcharge" value={net.solidarity} /><Result label="Church tax" value={net.church} /><Result label="Net pension payments" value={net.net} />
    </>}
  </Panel>;
}
