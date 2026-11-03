"use client";

/**
 * «Percorso» view of «Dove vanno i soldi» in Liquidità › Analisi: a sentence on what came in, went out and was set
 * aside, then the money-flow (Sankey) picture, wide on desktop and in two steps on the phone.
 */

import * as React from "react";
import { useLocalization } from "@/lib/localization/provider";
import type { FlowGroup, FlowSource, MoneyFlowLabels } from "@/lib/liquidity/money-flow";
import { FlowRiver } from "./flow-river";
import { FlowSteps } from "./flow-steps";
import { useWidth } from "./use-width";

export interface MoneyFlowViewProps {
  sources: readonly FlowSource[];
  groups: readonly FlowGroup[];
  formatValue: (n: number) => string;
  /** Called with a category picked in the picture (e.g. to open its movements). */
  onPickCategory?: (categoryId: string) => void;
}

/** Below this width (px) the wide picture has no room for its four columns and the phone steps are shown. */
export const MONEY_FLOW_WIDE_MIN = 640;

export function MoneyFlowView({ sources, groups, formatValue, onPickCategory }: MoneyFlowViewProps) {
  const { t: tr, language } = useLocalization();
  const [ref, width] = useWidth<HTMLDivElement>();
  const labels = React.useMemo<MoneyFlowLabels>(
    () => ({
      income: tr("Entrate"),
      saved: tr("Messo da parte"),
      fromSavings: tr("Presi dai risparmi"),
      // German nouns keep their capital letter.
      other: (group) => tr("Altre {0}", { 0: language === "de" ? group : group.toLowerCase() }),
    }),
    [tr, language]
  );
  const income = sources.reduce((sum, s) => sum + s.amount, 0);
  const spent = groups.reduce((sum, g) => sum + g.amount, 0);
  const saved = income - spent;
  const sentence =
    saved >= 0
      ? tr("Sono entrati {0}: {1} sono andati in spese e {2} sono rimasti da parte.", { 0: formatValue(income), 1: formatValue(spent), 2: formatValue(saved) })
      : tr("Sono entrati {0} e ne hai spesi {1}: {2} sono arrivati dai risparmi.", { 0: formatValue(income), 1: formatValue(spent), 2: formatValue(-saved) });
  const Picture = width >= MONEY_FLOW_WIDE_MIN ? FlowRiver : FlowSteps;

  return (
    <div>
      <p className="mb-6 max-w-[62ch] text-text-2">{sentence}</p>
      {/* Height reserved before the first measure, so the blocks below do not jump. */}
      <div ref={ref} className="min-h-[360px] w-full">
        {width > 0 && <Picture width={width} sources={sources} groups={groups} labels={labels} formatValue={formatValue} description={sentence} onPickCategory={onPickCategory} />}
      </div>
    </div>
  );
}
