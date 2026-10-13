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

export type InstrumentIconSize = "xs" | "sm" | "md";

/** Lato del riquadro e dimensione della sigla per ogni taglia. */
const SIZE_CLASSES: Record<InstrumentIconSize, { tile: string; text: string; pad: string; brandPad: string }> = {
  xs: { tile: "size-5 rounded-md", text: "text-[0.625rem]", pad: "p-0.5", brandPad: "p-1" },
  sm: { tile: "size-7 rounded-md", text: "text-xs", pad: "p-1", brandPad: "p-1.5" },
  md: { tile: "size-9 rounded-lg", text: "text-sm", pad: "p-1.5", brandPad: "p-2" },
};

export interface InstrumentIconProps {
  type: InstrumentType;
  name: string;
  /** Se c'è, si prova il logo remoto dello strumento (solo per i tipi che lo prevedono). */
  instrumentId?: string;
  /** `xs` (20 px) per chip e testi, `sm` (28 px) per elenchi compatti, `md` (36 px, default) per righe e intestazioni. */
  size?: InstrumentIconSize;
  /** Chiamata quando un logo remoto è stato mostrato (serve a chi deve citare la fonte dei loghi). */
  onRemoteLogo?: () => void;
  className?: string;
}

/** Il server decide se un logo esiste davvero; qui si evita solo di chiederlo dove non avrebbe mai senso. */
function wantsRemoteLogo(type: InstrumentType, name: string): boolean {
  if (type === "azione") return true;
  return (type === "etf" || type === "fondo") && findFundIssuer(name) !== null;
}

export function InstrumentIcon({ type, name, instrumentId, size = "md", onRemoteLogo, className }: InstrumentIconProps) {
  const icon = resolveInstrumentIcon({ type, name }, INSTRUMENT_TYPE_COLOR[type]);
  const [logo, setLogo] = React.useState<"pending" | "loaded" | "failed">("pending");
  // I marchi sono pensati per fondi chiari: il riquadro resta bianco anche nel tema scuro.
  const { tile: tileSize, text, pad, brandPad } = SIZE_CLASSES[size];
  const tile = cn("flex shrink-0 items-center justify-center overflow-hidden", tileSize);
  if (icon.kind === "image") {
    return (
      <span aria-hidden="true" className={cn(tile, "bg-white ring-1 ring-border", pad, className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG statico self-hosted, nessun bisogno dell'ottimizzatore */}
        <img src={icon.src} alt="" loading="lazy" className="size-full object-contain" />
      </span>
    );
  }
  if (icon.kind === "brand") {
    return (
      <span aria-hidden="true" className={cn(tile, "bg-white ring-1 ring-border", brandPad, className)}>
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
      className={cn("relative", tile, "font-heading font-semibold", text, showLogo && "bg-white ring-1 ring-border", className)}
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
          className={cn("absolute inset-0 size-full bg-white object-contain", pad, !showLogo && "opacity-0")}
        />
      ) : null}
    </span>
  );
}
