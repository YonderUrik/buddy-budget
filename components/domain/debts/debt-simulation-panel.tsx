"use client";

/**
 * "E se…" di un finanziamento: tre ipotesi nello stesso foglio (più ogni mese, estinzione di una parte, surroga).
 * Non scrive nulla: l'estinzione apre il dialog che già serve anche a registrarla.
 */

import * as React from "react";
import { LightbulbIcon, PiggyBankIcon } from "lucide-react";
import { PanelSection } from "@/components/domain/investments";
import { SegmentedControl } from "@/components/domain/shared";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import type { DebtView } from "@/lib/debts/view";
import { DebtExtraSim } from "./debt-extra-sim";
import { DebtRefinanceSim } from "./debt-refinance-sim";
import { DEBTS_COLORS } from "./debts-theme";

type SimulationKind = "extra" | "estinzione" | "surroga";

const OPTIONS = [
  { value: "extra", label: "Più ogni mese" },
  { value: "estinzione", label: "Una tantum" },
  { value: "surroga", label: "Surroga" },
] as const;

export interface DebtSimulationPanelProps {
  debt: DebtView;
  currency: string;
  /** Apre il dialog di estinzione anticipata (simulazione e, se già fatta, registrazione). */
  onOpenEarly: () => void;
}

export function DebtSimulationPanel({ debt, currency, onOpenEarly }: DebtSimulationPanelProps) {
  const [kind, setKind] = React.useState<SimulationKind>("extra");
  const select = (next: SimulationKind) => {
    setKind(next);
    track("debt_simulation_opened", { kind: next });
  };
  return (
    <PanelSection icon={LightbulbIcon} title="E se…" color={DEBTS_COLORS.simulate}>
      <SegmentedControl options={OPTIONS} value={kind} onChange={select} ariaLabel="Ipotesi da simulare" stretch />
      {kind === "extra" ? <DebtExtraSim debt={debt} currency={currency} /> : null}
      {kind === "estinzione" ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-foreground">E se versassi una somma in più, una volta? Vedi quanto risparmi di interessi e se ti conviene ridurre la rata o la durata. Se l&apos;hai già fatto, da qui puoi anche registrarla.</p>
          <Button className="w-fit" disabled={debt.plan.totals.finished} onClick={onOpenEarly}>
            <PiggyBankIcon aria-hidden="true" />
            Simula l&apos;estinzione
          </Button>
        </div>
      ) : null}
      {kind === "surroga" ? <DebtRefinanceSim debt={debt} currency={currency} /> : null}
    </PanelSection>
  );
}
