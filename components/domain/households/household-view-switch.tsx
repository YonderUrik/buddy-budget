"use client";

/** «Io · Noi due · Casa Milano» at the top of Panoramica: the viewer's own numbers or one of their groups. */

import { SegmentedControl } from "@/components/domain/shared";
import type { HouseholdSummary } from "@/lib/households/types";
import { useLocalization } from "@/lib/localization/provider";

/** Value of «Io» in the switch. */
export const OWN_VIEW = "io";

export interface HouseholdViewSwitchProps {
  groups: readonly HouseholdSummary[];
  /** Group id, or `OWN_VIEW`. */
  value: string;
  onChange: (value: string) => void;
}

export function HouseholdViewSwitch({ groups, value, onChange }: HouseholdViewSwitchProps) {
  const { t: tr } = useLocalization();
  const options = [{ value: OWN_VIEW, label: tr("Io") }, ...groups.map((g) => ({ value: g.id, label: g.name }))];
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <SegmentedControl options={options} value={value} onChange={onChange} ariaLabel="Di chi sono i numeri" />
    </div>
  );
}
