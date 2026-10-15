"use client";
import { germanIncomeForecast } from "@/lib/financial-planning";
import { useLocalization } from "@/lib/localization/provider";
import type { PlanEditorProps } from "./tax-editor";
import { Panel, Result, Amount, Choice } from "./fields";
/** Historical recorded income and gross/conditionally net German income forecasts. */
export function GermanIncomeView({ plan, data, onChange }: PlanEditorProps) {
  const { t, locale } = useLocalization(); const view = germanIncomeForecast(data, plan.tax, new Date().toISOString().slice(0, 10));
  const names = new Map(data.instruments.map(i => [i.id, i.name]));
  return <>
    <Panel title="Recorded income">{view.history.length === 0 ? <p>{t("No recorded income yet.")}</p> : view.history.map(y => <div key={y.year}><h3>{y.year}</h3><Result label="Gross income" value={y.gross} /><Result label="Recorded withholding and fees" value={y.withheld} /><Result label="Recorded net income" value={y.net} /></div>)}</Panel>
    <Panel title="Income forecast · next 12 months">
      <Choice label="Future-year net forecasts" value={plan.tax.futureForecast} options={[{ value: "verified", label: "Validated tax years only" }, { value: "constant-2026", label: "Compare using unchanged 2026 capital-tax rules" }]} onChange={v => onChange({ ...plan, tax: { ...plan.tax, futureForecast: v as typeof plan.tax.futureForecast } })} />
      {plan.tax.futureForecast === "constant-2026" && <p className="text-sm text-muted-foreground">{t("Future net amounts are scenarios using unchanged 2026 rules, not validated future tax assessments. Each January the allowance resets and projected losses carry forward. No external income, foreign tax credits or new fund advances are assumed for the future year.")}</p>}
      <p className="text-sm text-muted-foreground">{t("Gross forecasts repeat historical dividends for current holdings or use recorded bond terms. Payments and exchange rates can change. Missing history is not a forecast of zero income.")}</p>
      <Result label="Forecast gross income" value={view.totalGross} />
      <p className="text-sm text-muted-foreground">{t("Net forecasts use the Tax section's annual allowances and losses. They are unavailable for unvalidated tax years or incomplete tax history. Foreign withholding and treaty credits are not estimated.")}</p>
      {view.bondsWithoutTerms.length > 0 && <p>{t("Some bonds have no complete coupon terms.")}</p>}
      {view.events.length === 0 ? <p>{t("No payments can currently be forecast.")}</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th>{t("Date")}</th><th>{t("Instrument")}</th><th>{t("Gross income")}</th><th>{t("Estimated net income")}</th></tr></thead><tbody>{view.events.map((e, i) => <tr key={`${e.instrumentId}:${e.date}:${i}`} className="border-b"><td className="py-3">{new Intl.DateTimeFormat(locale).format(new Date(`${e.date}T12:00:00`))}</td><td>{names.get(e.instrumentId)}</td><td className="text-right"><Amount value={e.gross} /></td><td className="text-right"><Amount value={e.net} />{e.benchmark && <span className="block text-xs">{t("2026 rules scenario")}</span>}</td></tr>)}</tbody></table></div>}
    </Panel>
  </>;
}
