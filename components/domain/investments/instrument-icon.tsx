/**
 * Icona di uno strumento in un riquadro tondeggiante: icona della crypto, marchio dell'azienda (azioni) o sigla
 * dell'emittente/del nome (ETF, fondi, tutto il resto). La risoluzione è locale (`resolveInstrumentIcon`), niente
 * richieste a servizi esterni. Decorativa: il nome dello strumento è sempre scritto accanto.
 */

import type { InstrumentType } from "@/lib/db/schema/investments";
import { resolveInstrumentIcon } from "@/lib/investments/instrument-icon";
import { cn } from "@/lib/utils";
import { INSTRUMENT_TYPE_COLOR } from "./instrument-colors";

export interface InstrumentIconProps {
  type: InstrumentType;
  name: string;
  className?: string;
}

export function InstrumentIcon({ type, name, className }: InstrumentIconProps) {
  const icon = resolveInstrumentIcon({ type, name }, INSTRUMENT_TYPE_COLOR[type]);
  // I marchi sono pensati per fondi chiari: il riquadro resta bianco anche nel tema scuro.
  const tile = "flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg";
  if (icon.kind === "image") {
    return (
      <span aria-hidden="true" className={cn(tile, "bg-white p-1.5 ring-1 ring-border", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG statico self-hosted, nessun bisogno dell'ottimizzatore */}
        <img src={icon.src} alt="" loading="lazy" className="size-full object-contain" />
      </span>
    );
  }
  if (icon.kind === "brand") {
    return (
      <span aria-hidden="true" className={cn(tile, "bg-white p-2 ring-1 ring-border", className)}>
        <svg viewBox="0 0 24 24" className="size-full" fill={`#${icon.hex}`} focusable="false">
          <path d={icon.path} />
        </svg>
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(tile, "font-heading text-sm font-semibold", className)}
      style={{ color: icon.swatch, backgroundColor: `color-mix(in oklab, ${icon.swatch} 16%, transparent)` }}
    >
      {icon.text}
    </span>
  );
}
