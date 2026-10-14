"use client";
import { useLocalization } from "@/lib/localization/provider";

/** Campi condivisi dai dialog degli abbonamenti: nome, importo, cadenza, prossimo addebito, categoria. */

import * as React from "react";
import { CategoryPicker } from "@/components/domain/categories";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CADENCE_LABELS, SUBSCRIPTION_CADENCES, type SubscriptionCadence } from "@/lib/calc/subscriptions";
import type { Category } from "@/lib/db/schema/categories";
import { cn } from "@/lib/utils";

export function Field({ label, htmlFor, children, className }: { label: string; htmlFor: string; children: React.ReactNode; className?: string }) {
  const { t: tr } = useLocalization();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{tr(label)}</Label>
      {children}
    </div>
  );
}

/** Scelta della cadenza: menu nativo (accessibile e comodo da telefono). */
export function CadenceSelect({ id, value, onChange }: { id: string; value: SubscriptionCadence; onChange: (cadence: SubscriptionCadence) => void }) {
  const { t: tr } = useLocalization();
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value as SubscriptionCadence)}
      className="h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-8"
    >
      {SUBSCRIPTION_CADENCES.map((cadence) => (
        <option key={cadence} value={cadence}>
          {tr(CADENCE_LABELS[cadence])[0].toUpperCase() + tr(CADENCE_LABELS[cadence]).slice(1)}
        </option>
      ))}
    </select>
  );
}

export interface SubscriptionCategoryFieldProps {
  id: string;
  categories: readonly Category[];
  value: string;
  onChange: (categoryId: string) => void;
}

/** Categoria di spesa dell'abbonamento (le entrate non c'entrano). */
export function SubscriptionCategoryField({ id, categories, value, onChange }: SubscriptionCategoryFieldProps) {
  const { t: tr } = useLocalization();
  const expense = React.useMemo(() => categories.filter((c) => c.type !== "entrata" && c.type !== "trasferimento"), [categories]);
  return (
    <Field label={tr("Categoria")} htmlFor={id}>
      <CategoryPicker categories={expense} value={value} onValueChange={onChange} placeholder={tr("Nessuna categoria")} aria-label={tr("Categoria")} />
    </Field>
  );
}

export { Input };
