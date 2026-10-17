"use client";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";
/**
 * Sezioni «Cosa c'è dentro» e «Settori» di un ETF o fondo: primi titoli con il peso, con l'avviso dei titoli che
 * possiedi anche altrove (in altri fondi o direttamente), e pesi per settore della parte azionaria.
 */

import { LayersIcon, PieChartIcon } from "lucide-react";
import type { ProfileHolding } from "@/lib/db/schema/investments";
import { SECTOR_LABELS, type SectorKey } from "@/lib/investments/exposure-keys";
import type { HoldingElsewhere } from "@/lib/investments/overlap";
import { PanelSection } from "../panel-section";


function WeightRows({ rows, colorClass }: { rows: { key: string; label: string; weight: number }[]; colorClass: string }) {
  const { locale: formattingLocale } = useLocalization();
  const { formatPct } = localizedFormats(formattingLocale);

  const { t: tr } = useLocalization();
  const max = Math.max(...rows.map((r) => r.weight), 0.0001);
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.key} className="grid grid-cols-[minmax(0,9rem)_1fr_3rem] items-center gap-3 text-sm">
          <span className="truncate text-foreground">{tr(row.label)}</span>
          <span className="h-2 overflow-hidden rounded-full bg-muted">
            <span className={`block h-full rounded-full ${colorClass}`} style={{ width: `${(row.weight / max) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums text-muted-foreground">{formatPct(row.weight)}</span>
        </li>
      ))}
    </ul>
  );
}

/** "A, B e C (e altri 2) li hai anche in: …", in the user's language. */
function sharedText(shared: { holding: ProfileHolding; elsewhere: HoldingElsewhere[] }[], tr: (source: string, values?: Record<string, string | number>) => string): string {
  const names = shared.slice(0, 3).map((s) => s.holding.name);
  const places = [...new Set(shared.flatMap((s) => s.elsewhere.map((e) => (e.weight === null ? tr("direttamente") : e.name))))];
  const list = names.length > 1 ? tr("{0} e {1}", { 0: names.slice(0, -1).join(", "), 1: names[names.length - 1] }) : names[0];
  const more = shared.length > 3 ? tr(" (e altri {0})", { 0: shared.length - 3 }) : "";
  return tr("{0}{1} li hai anche in: {2}.", { 0: list, 1: more, 2: places.join(", ") });
}

export interface TitleCompositionSectionProps {
  holdings: ProfileHolding[];
  sectors: Record<string, number> | null;
  shared: { holding: ProfileHolding; elsewhere: HoldingElsewhere[] }[];
}

export function TitleCompositionSection({ holdings, sectors, shared }: TitleCompositionSectionProps) {
  const { locale: formattingLocale } = useLocalization();
  const { formatPct } = localizedFormats(formattingLocale);

  const { t: tr } = useLocalization();
  const top = holdings.slice(0, 10);
  const topShare = top.reduce((s, h) => s + h.weight, 0);
  const sectorRows = Object.entries(sectors ?? {})
    .filter(([, w]) => w > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([key, weight]) => ({ key, label: tr(SECTOR_LABELS[key as SectorKey]) ?? key, weight }));
  return (
    <div className="grid gap-10 lg:grid-cols-2">
      {top.length > 0 ? (
        <PanelSection icon={LayersIcon} title={tr("Cosa c'è dentro")} color="var(--swatch-emerald)" description={tr("Primi {0} titoli: {1} del fondo.", {0: top.length, 1: formatPct(topShare)})}>
          <WeightRows rows={top.map((h, i) => ({ key: `${h.symbol ?? h.name}-${i}`, label: h.name, weight: h.weight }))} colorClass="bg-[var(--swatch-emerald)]" />
          {shared.length > 0 ? <p className="text-sm text-muted-foreground">{sharedText(shared, tr)}</p> : null}
        </PanelSection>
      ) : null}
      {sectorRows.length > 0 ? (
        <PanelSection icon={PieChartIcon} title={tr("Settori")} color="var(--swatch-blue)" description={tr("Parte azionaria del fondo.")}>
          <WeightRows rows={sectorRows} colorClass="bg-[var(--swatch-blue)]" />
          <p className="text-xs text-muted-foreground">{tr("Fonte: Yahoo Finance. Le aree geografiche arriveranno con i file degli emittenti.")}</p>
        </PanelSection>
      ) : null}
    </div>
  );
}
