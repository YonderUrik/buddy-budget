"use client";
import { useLocalization } from "@/lib/localization/provider";

/** Selettore del fondo quando l'utente ne ha più di uno. */

import { SegmentedControl } from "@/components/domain/shared";

export interface PensionFundSelectorProps {
  funds: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
}

export function PensionFundSelector({ funds, value, onChange }: PensionFundSelectorProps) {
  const { t: tr } = useLocalization();
  return <SegmentedControl options={funds.map((f) => ({ value: f.id, label: f.name }))} value={value} onChange={onChange} ariaLabel={tr("Fondo")} className="max-w-full overflow-x-auto" />;
}
