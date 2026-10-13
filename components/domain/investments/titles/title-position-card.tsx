/**
 * Sezione "La tua posizione" sul titolo: valore e guadagno sul prezzo medio, proventi incassati, quote e prezzo medio,
 * tutto nella valuta del titolo (senza cambi, commissioni né tasse).
 */

import { BriefcaseIcon } from "lucide-react";
import type { TitlePosition } from "@/lib/investments/title-view";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { formatSignedPct } from "../gain-text";
import { PanelSection } from "../panel-section";
import { formatPrice } from "./title-format";

const QUANTITY_FORMAT = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 6 });

export interface TitlePositionCardProps {
  position: TitlePosition;
  currency: string;
  /** Testo dell'azione secondaria (es. "Registra un'operazione"). */
  action?: React.ReactNode;
}

function signClass(value: number | null): string {
  return value === null ? "text-foreground" : value < 0 ? "text-neg" : "text-pos";
}

export function TitlePositionCard({ position, currency, action }: TitlePositionCardProps) {
  const gain = position.gain;
  const items: { label: string; value: React.ReactNode; className?: string }[] = [
    { label: "Valore", value: formatCurrency(position.value, currency) },
    {
      label: "Guadagno sul prezzo medio",
      value:
        gain !== null
          ? `${gain < 0 ? "−" : "+"}${formatCurrency(Math.abs(gain), currency)}${position.changeVsAverage !== null ? ` · ${formatSignedPct(position.changeVsAverage)}` : ""}`
          : "—",
      className: signClass(gain),
    },
    { label: "Quote", value: QUANTITY_FORMAT.format(position.quantity) },
    { label: "Prezzo medio", value: position.averagePrice !== null ? formatPrice(position.averagePrice, currency) : "—" },
  ];
  if (position.incomeReceived > 0) items.splice(2, 0, { label: "Proventi incassati (lordi)", value: formatCurrency(position.incomeReceived, currency) });
  return (
    <PanelSection icon={BriefcaseIcon} title="La tua posizione" color="var(--primary)" action={action}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
        {items.map((item) => (
          <div key={item.label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{item.label}</dt>
            <dd className={cn("font-heading text-lg font-medium tabular-nums", item.className ?? "text-foreground")}>{item.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">
        Valori nella valuta del titolo ({currency}), senza cambio né tasse. Il guadagno completo è nelle schede Portafoglio e Tasse.
      </p>
    </PanelSection>
  );
}
