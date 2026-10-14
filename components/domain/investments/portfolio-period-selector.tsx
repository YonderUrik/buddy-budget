"use client";
import { useLocalization } from "@/lib/localization/provider";

import { useState } from "react";
import { SegmentedControl } from "@/components/domain/shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { validChartRange, type PortfolioChartPeriod, type PortfolioChartRange } from "@/lib/investments/chart-period";

const OPTIONS = [
  { value: "1mese", label: "1M" }, { value: "3mesi", label: "3M" },
  { value: "ytd", label: "YTD" }, { value: "1anno", label: "1A" },
  { value: "max", label: "Max" }, { value: "custom", label: "Personalizzato" },
] as const;

export interface PortfolioPeriodSelectorProps {
  value: PortfolioChartPeriod;
  range: PortfolioChartRange;
  today: string;
  onChange: (period: PortfolioChartPeriod) => void;
  onRangeChange: (range: PortfolioChartRange) => void;
}

/** Portfolio chart presets and an explicitly applied, validated inclusive date range. */
export function PortfolioPeriodSelector({ value, range, today, onChange, onRangeChange }: PortfolioPeriodSelectorProps) {
  const { t: tr } = useLocalization();
  const [draft, setDraft] = useState(range);
  const valid = validChartRange(draft, today);
  return <div className="flex min-w-0 flex-col gap-2">
    <SegmentedControl options={OPTIONS} value={value} onChange={onChange} ariaLabel={tr("Periodo del grafico")} className="max-w-full flex-wrap" />
    {value === "custom" ? <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); if (valid) onRangeChange(draft); }}>
      <label className="grid gap-1 text-xs">{tr("Dal")}<Input type="date" value={draft.from} max={draft.to || today} required onChange={(event) => setDraft({ ...draft, from: event.target.value })} /></label>
      <label className="grid gap-1 text-xs">{tr("Al")}<Input type="date" value={draft.to} min={draft.from} max={today} required onChange={(event) => setDraft({ ...draft, to: event.target.value })} /></label>
      <Button type="submit" size="sm" disabled={!valid}>{tr("Applica")}</Button>
      {!valid ? <p role="status" className="w-full text-xs text-destructive">{tr("Scegli date valide, in ordine e non successive a oggi.")}</p> : null}
    </form> : null}
  </div>;
}
