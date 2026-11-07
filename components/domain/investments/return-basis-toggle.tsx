"use client";

import { SegmentedControl } from "@/components/domain/shared";
import type { ReturnBasis } from "@/lib/investments/view";

const OPTIONS = [
  { value: "securities", label: "Sui titoli" },
  { value: "capital", label: "Sul tuo capitale" },
] as const satisfies readonly { value: ReturnBasis; label: string }[];

export interface ReturnBasisToggleProps {
  value: ReturnBasis;
  onChange: (basis: ReturnBasis) => void;
}

/** «Sui titoli» / «Sul tuo capitale»: returns on the securities, or on the money that is the user's own once the margin loan is subtracted. */
export function ReturnBasisToggle({ value, onChange }: ReturnBasisToggleProps) {
  return <SegmentedControl options={OPTIONS} value={value} onChange={onChange} ariaLabel="Rendimento misurato" />;
}
