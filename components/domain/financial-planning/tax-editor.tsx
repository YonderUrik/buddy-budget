"use client";
import type { InvestmentData } from "@/lib/investments/data";
import { germanPortfolioReport, germanFundAdvance, type GermanPlan, type TaxIssue } from "@/lib/financial-planning";
import { useLocalization } from "@/lib/localization/provider";
import { NumberField, Choice, Panel, Result, Amount, FUND_OPTIONS } from "./fields";
import { SaleSimulator } from "./sale-simulator";
import { CryptoEditor } from "./crypto-editor";
export interface PlanEditorProps { plan: GermanPlan; onChange: (plan: GermanPlan) => void; data: InvestmentData }
const REASONS: Record<TaxIssue["reason"], string> = {
  currency: "German tax estimates require portfolio currency EUR.", history: "Confirm complete acquisition history and custody accounts before calculating.",
  classification: "Confirm the fund tax classification using its documentation.", "fund-history": "Confirm prior fund advances and any taxable advances received this year.",
  legacy: "Pre-2009 securities and pre-2018 fund lots need individual tax treatment.", unsupported: "This instrument or adjustment requires individual tax treatment.",
  "missing-lots": "A sale has missing acquisition lots. Add the original purchases in the same custody account.", invalid: "An operation has missing or invalid amounts.",
};
/** German annual FIFO report and fund advance scenario, with completeness checks and explicit assumptions. */
export function TaxEditor({ plan, onChange, data }: PlanEditorProps) {
  const { t, locale } = useLocalization();
  const formatDate = (date: string) => new Intl.DateTimeFormat(locale).format(new Date(`${date}T12:00:00`));
  const p = plan.tax;
  const update = (patch: Partial<typeof p>) => onChange({ ...plan, tax: { ...p, ...patch } });
  const report = germanPortfolioReport(data, p, new Date().toISOString().slice(0, 10));
  const advance = germanFundAdvance(plan.fund);
  const names = new Map(data.instruments.map(i => [i.id, i.name]));
  const funds = data.instruments.filter(i => ["etf", "fondo"].includes(i.type) && data.transactions.some(tx => tx.instrumentId === i.id));
  const sales = data.transactions.filter(tx => tx.type === "vendita" && tx.date.startsWith("2026") && funds.some(f => f.id === tx.instrumentId));
  return <>
    <Panel title="German investment taxes · 2026">
      <p className="text-sm text-muted-foreground">{t("Annual private-investor estimate in EUR, using FIFO separately for each custody account. This is not a broker withholding calculation. Foreign tax credits, treaty relief, business holdings and favourable-rate assessment require individual review.")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Choice label="Assessment" value={p.joint ? "joint" : "single"} options={[{ value: "single", label: "Individual (€1,000 allowance)" }, { value: "joint", label: "Joint (€2,000 allowance)" }]} onChange={v => update({ joint: v === "joint" })} />
        <Choice label="Church tax" value={String(p.churchRate)} options={[{ value: "0", label: "None" }, { value: "0.08", label: "8%" }, { value: "0.09", label: "9%" }]} onChange={v => update({ churchRate: Number(v) as 0 | 0.08 | 0.09 })} />
        <NumberField label="Allowance already used outside this portfolio (€)" value={p.allowanceUsedElsewhere} onChange={v => update({ allowanceUsedElsewhere: v })} />
        <NumberField label="Verified creditable foreign tax after allowances and losses (€)" value={p.verifiedForeignCredit} onChange={v => update({ verifiedForeignCredit: v })} />
        <NumberField label="Share loss carryforward (€)" value={p.shareLosses} onChange={v => update({ shareLosses: v })} />
        <NumberField label="General loss carryforward (€)" value={p.generalLosses} onChange={v => update({ generalLosses: v })} />
        <NumberField label="Additional taxable capital income / advances received (€)" value={p.otherCapitalIncome} onChange={v => update({ otherCapitalIncome: v })} />
      </div>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={p.historyConfirmed} onChange={e => update({ historyConfirmed: e.target.checked })} />{t("I have checked the full acquisition history, custody accounts and loss balances. No unrecorded transfers or corporate actions affect these lots.")}</label>
      <p className="text-sm text-muted-foreground">{t("Use available loss balances only; cross-bank offsets may require a loss certificate and assessment. Do not enter the same external income both as used allowance and additional income.")}</p>
      {report.issues.length > 0 && <ul className="list-disc space-y-1 pl-5 text-sm" aria-label={t("Information needed")}>{report.issues.map(i => <li key={`${i.instrumentId}:${i.reason}`}>{names.get(i.instrumentId)}{i.instrumentId ? ": " : ""}{t(REASONS[i.reason])}</li>)}</ul>}
      <p className="text-sm text-muted-foreground">{t("Enter only foreign tax confirmed as creditable for these taxable earnings after treaty limits, refunds, allowances and losses. Recorded withholding is not automatically treated as creditable.")}</p>
      <Result label="Foreign tax credit applied" value={report.estimate?.foreignCredit ?? null} />
      <Result label="Estimated capital income tax" value={report.estimate?.capitalTax ?? null} />
      <Result label="Solidarity surcharge" value={report.estimate?.solidarity ?? null} />
      <Result label="Church tax" value={report.estimate?.church ?? null} />
      <Result label="Estimated total tax" value={report.estimate?.total ?? null} />
      <Result label="Recorded taxes (shown separately)" value={report.recordedTaxes} />
      <Result label="Remaining share losses" value={report.estimate?.remainingShareLosses ?? null} />
      <Result label="Remaining general losses" value={report.estimate?.remainingGeneralLosses ?? null} />
      <details><summary>{t("Realised events included")}</summary>{report.events.map(e => <div className="flex justify-between gap-3 py-2 text-sm" key={e.id}><span>{formatDate(e.date)} · {names.get(e.instrumentId)}</span><Amount value={e.taxable} /></div>)}</details>
    </Panel>
    <Panel title="Funds and ETFs">
      <p className="text-sm text-muted-foreground">{t("Classification must come from the fund tax documents, not its name. Enter gross prior advances attributable to each sale before partial exemption. Enter this year's taxable advances above as additional capital income.")}</p>
      {funds.map(f => <Choice key={f.id} label={f.name} value={p.fundKinds[f.id] ?? "unknown"} options={FUND_OPTIONS} onChange={v => update({ fundKinds: { ...p.fundKinds, [f.id]: v as typeof plan.fund.kind } })} />)}
      {sales.map(s => <NumberField key={s.id} label={`${names.get(s.instrumentId)} · ${formatDate(s.date)} · ${t("Prior gross advances (€)")}`} value={p.priorAdvancesBySale[s.id] ?? 0} onChange={v => update({ priorAdvancesBySale: { ...p.priorAdvancesBySale, [s.id]: v } })} />)}
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={p.fundHistoryConfirmed} onChange={e => update({ fundHistoryConfirmed: e.target.checked })} />{t("I checked prior advances and current-year advance income against broker records. The fund classification did not change during the holding period.")}</label>
      <h3 className="font-medium">{t("2026 Vorabpauschale scenario")}</h3>
      <Choice label="Fund classification" value={plan.fund.kind} options={FUND_OPTIONS} onChange={v => onChange({ ...plan, fund: { ...plan.fund, kind: v as typeof plan.fund.kind } })} />
      <div className="grid gap-4 sm:grid-cols-2">{([['startValue', 'Value at start of year (€)'], ['endValue', 'Value at end of year (€)'], ['distributions', 'Annual distributions (€)'], ['acquisitionMonth', 'Acquisition month (1–12)']] as const).map(([key, label]) => <NumberField key={key} label={label} value={plan.fund[key]} min={key === 'acquisitionMonth' ? 1 : 0} max={key === 'acquisitionMonth' ? 12 : undefined} step={key === 'acquisitionMonth' ? 1 : 0.01} onChange={v => onChange({ ...plan, fund: { ...plan.fund, [key]: v } })} />)}</div>
      <Result label="Gross advance amount" value={advance.gross} /><Result label="After partial exemption" value={advance.taxable} />
      <p className="text-sm text-muted-foreground">{t("Uses the official 2026 base rate of 3.20%. For one unchanged lot held through year-end; values use the same number of units. The advance is received in 2027. No 2027 tax estimate is shown until that year's rules are validated.")}</p>
    </Panel>
    <SaleSimulator key={JSON.stringify(plan.tax)} plan={plan} onChange={onChange} data={data} />
    <CryptoEditor plan={plan} onChange={onChange} />
  </>;
}
