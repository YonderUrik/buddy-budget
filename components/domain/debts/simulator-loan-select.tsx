/** Scelta del finanziamento su cui simulare (le schede del Simulatore ne usano uno alla volta). */

import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DebtView } from "@/lib/debts/view";

export interface SimulatorLoanSelectProps {
  loans: DebtView[];
  value: string;
  onChange: (id: string) => void;
  id?: string;
  className?: string;
}

export function SimulatorLoanSelect({ loans, value, onChange, id, className }: SimulatorLoanSelectProps) {
  return (
    <Select value={value} onValueChange={(next) => next && onChange(next)}>
      <SelectTrigger id={id} className={cn("w-full", className)}>
        <SelectValue>{loans.find((l) => l.id === value)?.name}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {loans.map((loan) => (
          <SelectItem key={loan.id} value={loan.id}>
            {loan.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
