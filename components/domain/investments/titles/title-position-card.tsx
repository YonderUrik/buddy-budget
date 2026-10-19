"use client";

import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";
/**
 * Sezione "La tua posizione" sul titolo: valore e guadagno sul prezzo medio, proventi incassati, quote e prezzo medio,
 * tutto nella valuta del titolo (senza cambi, commissioni né tasse).
 */

import { BriefcaseIcon } from "lucide-react";
import type { TitlePosition } from "@/lib/investments/title-view";

import { cn } from "@/lib/utils";

import { PanelSection } from "../panel-section";
import { privateNumberFormat } from "@/lib/format";




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
  const { locale: formattingLocale } = useLocalization();
  const { formatSignedPct, formatPrice } = localizedFormats(formattingLocale);


  const { formatCurrency } = localizedFormats(formattingLocale);
  const QUANTITY_FORMAT = privateNumberFormat(formattingLocale, { maximumFractionDigits: 6 });

  const { t: tr, features } = useLocalization();
  const gain = position.gain;
  const items: { label: string; value: React.ReactNode; className?: string }[] = [
    { label: tr("Valore"), value: formatCurrency(position.value, currency) },
    {
      label: tr("Guadagno sul prezzo medio"),
      value:
        gain !== null
          ? `${gain < 0 ? "−" : "+"}${formatCurrency(Math.abs(gain), currency)}${position.changeVsAverage !== null ? ` · ${formatSignedPct(position.changeVsAverage)}` : ""}`
          : "—",
      className: signClass(gain),
    },
    { label: tr("Quote"), value: QUANTITY_FORMAT.format(position.quantity) },
    { label: tr("Prezzo medio"), value: position.averagePrice !== null ? formatPrice(position.averagePrice, currency) : "—" },
  ];
  if (position.incomeReceived > 0) items.splice(2, 0, { label: tr("Proventi incassati (lordi)"), value: formatCurrency(position.incomeReceived, currency) });
  return (
    <PanelSection icon={BriefcaseIcon} title={tr("La tua posizione")} color="var(--primary)" action={action}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
        {items.map((item) => (
          <div key={item.label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{tr(item.label)}</dt>
            <dd className={cn("font-heading text-lg font-medium tabular-nums", item.className ?? "text-foreground")}>{item.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">{tr("Valori nella valuta del titolo (")}{currency}{tr(features.taxes ? "), senza cambio né tasse. Il guadagno completo è nelle schede Portafoglio e Tasse." : "), senza cambio né stime fiscali.")}</p>
    </PanelSection>
  );
}
