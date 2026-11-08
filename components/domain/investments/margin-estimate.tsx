"use client";

import * as React from "react";
import { Slider } from "@/components/ui/slider";
import { track } from "@/lib/analytics";
import { DEFAULT_MAINTENANCE_MARGIN, marginCallDrop } from "@/lib/calc/leverage";
import { localizedFormats } from "@/lib/localization/format";
import { useLocalization } from "@/lib/localization/provider";

/** Range of the maintenance margin the user can set, in whole percent. */
const MAINTENANCE_MIN = 10;
const MAINTENANCE_MAX = 60;
const MAINTENANCE_STORAGE_KEY = "bb:leverage-maintenance";
const MAINTENANCE_CHANGED_EVENT = "bb:leverage-maintenance-changed";

function readStoredMaintenance(): number {
  if (typeof window === "undefined") return DEFAULT_MAINTENANCE_MARGIN * 100;
  try {
    const stored = Number(window.localStorage.getItem(MAINTENANCE_STORAGE_KEY));
    return stored >= MAINTENANCE_MIN && stored <= MAINTENANCE_MAX ? stored : DEFAULT_MAINTENANCE_MARGIN * 100;
  } catch {
    return DEFAULT_MAINTENANCE_MARGIN * 100;
  }
}

/**
 * The maintenance margin chosen by the user, in whole percent, remembered on this device. Every component using it
 * follows a change made elsewhere on the page (the strip's figure follows the slider in the details).
 */
export function useMaintenanceMargin(): [number, (value: number) => void] {
  // Rendered only after the portfolio data loads in the browser, so the stored value can be read on the first render.
  const [maintenance, setMaintenance] = React.useState(readStoredMaintenance);
  React.useEffect(() => {
    const sync = () => setMaintenance(readStoredMaintenance());
    window.addEventListener(MAINTENANCE_CHANGED_EVENT, sync);
    return () => window.removeEventListener(MAINTENANCE_CHANGED_EVENT, sync);
  }, []);
  const change = React.useCallback((value: number) => {
    setMaintenance(value);
    try { window.localStorage.setItem(MAINTENANCE_STORAGE_KEY, String(value)); } catch { /* the choice just is not remembered */ }
    window.dispatchEvent(new Event(MAINTENANCE_CHANGED_EVENT));
  }, []);
  return [maintenance, change];
}

export interface MarginEstimateProps {
  loan: number;
  securities: number;
}

/**
 * «Quanto possono scendere i titoli»: the fall that brings the loan to the maintenance margin, with the margin set by the
 * user. An estimate, said so: IBKR's real requirement is per security and is not in the CSV.
 */
export function MarginEstimate({ loan, securities }: MarginEstimateProps) {
  const { t: tr, locale } = useLocalization();
  const { formatPct } = localizedFormats(locale);
  const id = React.useId();
  const [maintenance, change] = useMaintenanceMargin();
  const drop = marginCallDrop(loan, securities, maintenance / 100);
  if (drop === null) return null;

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-muted/50 p-3">
      <p className="text-sm">
        {drop === 0
          ? tr("Con un margine di mantenimento del {0} il conto è già al limite: il broker può vendere i titoli.", { 0: formatPct(maintenance / 100, 0) })
          : tr("Con un margine di mantenimento del {0}, un calo del {1} dei titoli porta il prestito al limite del margine.", { 0: formatPct(maintenance / 100, 0), 1: formatPct(drop, 0) })}
      </p>
      <label id={id} className="text-xs text-muted-foreground">{tr("Margine di mantenimento: {0}", { 0: formatPct(maintenance / 100, 0) })}</label>
      <Slider value={[maintenance]} min={MAINTENANCE_MIN} max={MAINTENANCE_MAX} step={5} aria-labelledby={id}
        onValueChange={(v) => change(Array.isArray(v) ? v[0] : (v as number))}
        onValueCommitted={(v) => track("investment_margin_estimate_changed", { maintenance: Array.isArray(v) ? v[0] : (v as number) })} />
      <p className="text-xs text-muted-foreground">{tr("È una stima con il prestito di oggi fermo: Interactive Brokers fissa un requisito per ogni titolo e lo può cambiare, e il rendiconto CSV non lo riporta. Il valore reale è in Trader Workstation.")}</p>
    </div>
  );
}
