"use client";

/**
 * Interruttore Operazioni / Rendiconti broker: i rendiconti importati stanno nella scheda Operazioni, non in una
 * scheda a sé. Compare solo se esiste almeno un rendiconto (chi non importa dal broker non vede niente in più).
 */

import { useRouter } from "next/navigation";
import { SegmentedControl } from "@/components/domain/shared";
import { useBrokerStatementsQuery } from "@/lib/queries/investments";

export type OperationsView = "operazioni" | "rendiconti";

const OPERATIONS_VIEW_HREF: Record<OperationsView, string> = {
  operazioni: "/investimenti/operazioni",
  rendiconti: "/investimenti/rendiconti",
};

const OPERATIONS_VIEW_OPTIONS = [
  { value: "operazioni", label: "Operazioni" },
  { value: "rendiconti", label: "Rendiconti broker" },
] as const;

export interface OperationsViewSwitchProps {
  value: OperationsView;
}

export function OperationsViewSwitch({ value }: OperationsViewSwitchProps) {
  const router = useRouter();
  const statements = useBrokerStatementsQuery();
  if (!statements.data?.statements.length) return null;
  return (
    <SegmentedControl<OperationsView>
      options={OPERATIONS_VIEW_OPTIONS}
      value={value}
      onChange={(next) => router.push(OPERATIONS_VIEW_HREF[next])}
      ariaLabel="Operazioni o rendiconti del broker"
      stretch
      className="sm:w-fit"
    />
  );
}
