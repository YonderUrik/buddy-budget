"use client";

/** Spese accessorie del finanziamento (istruttoria, assicurazione, incasso rata): voci libere, decise dall'utente. */

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AddDebtCostField } from "@/lib/debts/add-form";
import { DEBT_MAX_COSTS } from "@/lib/validation/debts";

const KIND_LABELS: Record<AddDebtCostField["kind"], string> = { una_tantum: "Una tantum", per_rata: "Ogni rata" };

export interface AddDebtCostsFieldProps {
  costs: AddDebtCostField[];
  onChange: (costs: AddDebtCostField[]) => void;
}

export function AddDebtCostsField({ costs, onChange }: AddDebtCostsFieldProps) {
  const update = (index: number, patch: Partial<AddDebtCostField>) => onChange(costs.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  return (
    <div className="flex flex-col gap-2">
      {costs.map((cost, index) => (
        <div key={index} className="grid grid-cols-[1fr_6rem_7.5rem_auto] items-center gap-2">
          <Input aria-label="Nome della spesa" placeholder="Es. Assicurazione" value={cost.label} onChange={(e) => update(index, { label: e.target.value })} />
          <Input aria-label="Importo della spesa" inputMode="decimal" placeholder="€" value={cost.amount} onChange={(e) => update(index, { amount: e.target.value })} />
          <Select value={cost.kind} onValueChange={(v) => v && update(index, { kind: v as AddDebtCostField["kind"] })}>
            <SelectTrigger aria-label="Quando si paga">
              <SelectValue>{(v: string | null) => (v ? KIND_LABELS[v as AddDebtCostField["kind"]] : "")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(KIND_LABELS) as AddDebtCostField["kind"][]).map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {KIND_LABELS[kind]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Togli la spesa" onClick={() => onChange(costs.filter((_, i) => i !== index))}>
            <X size={15} aria-hidden="true" />
          </Button>
        </div>
      ))}
      {costs.length < DEBT_MAX_COSTS ? (
        <Button type="button" variant="ghost" size="sm" className="self-start gap-1" onClick={() => onChange([...costs, { label: "", amount: "", kind: "una_tantum" }])}>
          <Plus size={14} aria-hidden="true" /> Aggiungi una spesa
        </Button>
      ) : null}
    </div>
  );
}
