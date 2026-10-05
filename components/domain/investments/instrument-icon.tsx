"use client";

/**
 * Icona di uno strumento in un riquadro tondeggiante: icona della crypto, marchio dell'azienda (azioni) o sigla
 * dell'emittente/del nome (ETF, fondi, tutto il resto). Con `instrumentId`, per azioni ed ETF di un emittente noto
 * prova anche il logo servito dal nostro server (`/api/instruments/[id]/logo`): finché non arriva, o se non c'è,
 * resta la sigla. Il browser non parla mai con servizi esterni. Decorativa: il nome è sempre scritto accanto.
 */

import * as React from "react";
import type { InstrumentType } from "@/lib/db/schema/investments";
import { findFundIssuer, resolveInstrumentIcon } from "@/lib/investments/instrument-icon";
import { cn } from "@/lib/utils";
import { INSTRUMENT_TYPE_COLOR } from "./instrument-colors";

export interface InstrumentIconProps {
  type: InstrumentType;
  name: string;
  /** Se c'è, si prova il logo remoto dello strumento (solo per i tipi che lo prevedono). */
  instrumentId?: string;
  /** Chiamata quando un logo remoto è stato mostrato (serve a chi deve citare la fonte dei loghi). */
  onRemoteLogo?: () => void;
  className?: string;
}

/** Il server decide se un logo esiste davvero; qui si evita solo di chiederlo dove non avrebbe mai senso. */
function wantsRemoteLogo(type: InstrumentType, name: string): boolean {
  if (type === "azione") return true;
  return (type === "etf" || type === "fondo") && findFundIssuer(name) !== null;
}

export function InstrumentIcon({ type, name, instrumentId, onRemoteLogo, className }: InstrumentIconProps) {
  const icon = resolveInstrumentIcon({ type, name }, INSTRUMENT_TYPE_COLOR[type]);
  const [logo, setLogo] = React.useState<"pending" | "loaded" | "failed">("pending");
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
  const remote = instrumentId !== undefined && logo !== "failed" && wantsRemoteLogo(type, name);
  const showLogo = remote && logo === "loaded";
  return (
    <span
      aria-hidden="true"
      className={cn("relative", tile, "font-heading text-sm font-semibold", showLogo && "bg-white ring-1 ring-border", className)}
      style={showLogo ? undefined : { color: icon.swatch, backgroundColor: `color-mix(in oklab, ${icon.swatch} 16%, transparent)` }}
    >
      {showLogo ? null : icon.text}
      {remote ? (
        // eslint-disable-next-line @next/next/no-img-element -- immagine dal nostro server, già ridimensionata
        <img
          src={`/api/instruments/${instrumentId}/logo`}
          alt=""
          loading="lazy"
          onLoad={() => {
            setLogo("loaded");
            onRemoteLogo?.();
          }}
          onError={() => setLogo("failed")}
          className={cn("absolute inset-0 size-full bg-white object-contain p-1.5", !showLogo && "opacity-0")}
        />
      ) : null}
    </span>
  );
}
