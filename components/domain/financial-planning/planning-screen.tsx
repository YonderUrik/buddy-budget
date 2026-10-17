"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useInvestmentsOverviewQuery } from "@/lib/queries/investments";
import { germanPlanSchema, type GermanPlan, type PlanningSection } from "@/lib/financial-planning";
import type { InvestmentData } from "@/lib/investments/data";
import { useLocalization } from "@/lib/localization/provider";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { TaxEditor } from "./tax-editor";
import { PensionEditor } from "./pension-editor";
import { RetirementEditor } from "./retirement-editor";
import { GermanIncomeView } from "./income-view";
import { PAGE_TITLE } from "@/components/domain/shared";

interface SavedPlan { plan: GermanPlan; revision: number }
const KEY = ["financial-planning", "DE"] as const;
const TITLES = { tax: "German investment taxes · 2026", income: "Income", pension: "German pensions", retirement: "Retirement planning" };
function Editor({ saved, section, data }: { saved: SavedPlan; section: PlanningSection; data: InvestmentData }) {
  const { t } = useLocalization(); const client = useQueryClient();
  const [plan, setPlan] = useState(saved.plan); const [saving, setSaving] = useState(false); const [message, setMessage] = useState("");
  const validation = germanPlanSchema.safeParse(plan);
  const dirty = JSON.stringify(plan) !== JSON.stringify(saved.plan);
  async function save() {
    if (!validation.success) return;
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/financial-planning", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: validation.data, revision: saved.revision }) });
      if (!response.ok) { setMessage(response.status === 409 ? "This plan changed in another tab. Reload before saving." : "Could not save. Your changes are still here."); return; }
      client.setQueryData(KEY, await response.json());
      track("financial_plan_saved", { country: "DE", section });
    } catch { setMessage("Could not save. Your changes are still here."); }
    finally { setSaving(false); }
  }
  const props = { plan, onChange: setPlan, data };
  return <div className="space-y-6">
    <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background p-3">
      <span className="text-sm">{t(dirty ? "Unsaved changes" : "Plan saved")}</span>
      <Button type="button" disabled={saving || !dirty || !validation.success} onClick={save}>{t(saving ? "Saving…" : "Save plan")}</Button>
    </div>
    {message && <p role="alert">{t(message)}</p>}
    {!validation.success && <p role="alert">{t("Check the entered names, dates and numeric limits before saving.")}</p>}
    {section === "tax" && <TaxEditor {...props} />}
    {section === "income" && <GermanIncomeView {...props} />}
    {section === "pension" && <PensionEditor {...props} />}
    {section === "retirement" && <RetirementEditor {...props} />}
    <p className="text-xs text-muted-foreground">{t("Planning estimates for German residents holding private assets. Results depend on complete records and your assumptions; they do not replace a tax return or pension statement.")}</p>
    <details className="text-sm"><summary>{t("Rules and official sources")}</summary><ul className="list-disc space-y-2 pl-5"><li><a href="https://www.gesetze-im-internet.de/estg/__32d.html" target="_blank" rel="noreferrer">EStG §32d</a></li><li><a href="https://www.gesetze-im-internet.de/invstg_2018/__18.html" target="_blank" rel="noreferrer">InvStG §18</a></li><li><a href="https://www.gesetze-im-internet.de/invstg_2018/__20.html" target="_blank" rel="noreferrer">InvStG §20</a></li><li><a href="https://www.gesetze-im-internet.de/rwbestv_2026/BJNR0B20A0026.html" target="_blank" rel="noreferrer">RWBestV 2026</a></li><li><a href="https://www.gesetze-im-internet.de/estg/__23.html" target="_blank" rel="noreferrer">EStG §23</a></li></ul></details>
  </div>;
}
/** Persisted German financial screens; country-specific components never mount Italian calculation providers. */
export function PlanningScreen({ section }: { section: PlanningSection }) {
  const { t } = useLocalization();
  const query = useQuery<SavedPlan>({ queryKey: KEY, queryFn: async () => {
    const response = await fetch("/api/financial-planning");
    if (!response.ok) throw new Error("Could not load plan");
    const body = await response.json(); return { ...body, plan: germanPlanSchema.parse(body.plan) };
  } });
  const overview = useInvestmentsOverviewQuery("max");
  return <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
    <h1 className={PAGE_TITLE}>{t(TITLES[section])}</h1>
    {query.isError || overview.isError ? <div role="alert"><p>{t("Could not load the plan.")}</p><Button onClick={() => { void query.refetch(); void overview.refetch(); }}>{t("Retry")}</Button></div> : !query.data || !overview.data ? <p aria-busy="true">{t("Loading…")}</p> : overview.data.currency !== "EUR" ? <p>{t("German financial planning currently requires account currency EUR. Your saved data has not been changed.")}</p> : <Editor key={`${section}:${query.data.revision}`} saved={query.data} section={section} data={overview.data} />}
  </div>;
}
