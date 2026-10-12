"use client";

/**
 * Logo di un esercente: l'iniziale su un fondo tenue e, se il server ha trovato un logo per il gruppo (`logoPath`: marchio
 * del dizionario, sito scritto nel movimento o nome cercato su Logo.dev), l'immagine servita dal nostro server. Finché il
 * logo non arriva, o se non c'è, resta l'iniziale (o il `fallback` passato). Decorativo: il nome è sempre scritto accanto.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export type MerchantLogoSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<MerchantLogoSize, { tile: string; text: string; pad: string }> = {
  sm: { tile: "size-9", text: "text-sm", pad: "p-1.5" },
  md: { tile: "size-11", text: "text-base", pad: "p-2" },
  lg: { tile: "size-14", text: "text-xl", pad: "p-2.5" },
};

export interface MerchantLogoProps {
  /** Nome dell'esercente (per l'iniziale). */
  name: string;
  /** Indirizzo del logo sul nostro server, dal gruppo (`logoPath`); null o assente = solo l'iniziale. */
  logoPath?: string | null;
  /** `sm` 36 px, `md` 44 px (default), `lg` 56 px. */
  size?: MerchantLogoSize;
  /** Chiamata quando è stato mostrato un logo remoto (serve a chi deve citare la fonte dei loghi). */
  onRemoteLogo?: () => void;
  /** Cosa mostrare finché il logo non c'è, al posto dell'iniziale (es. l'icona della categoria in Movimenti). */
  fallback?: React.ReactNode;
  className?: string;
}

/** Prima lettera o cifra del nome, maiuscola. */
function initialOf(name: string): string {
  const match = name.match(/[\p{L}\p{N}]/u);
  return match ? match[0].toUpperCase() : "·";
}

export function MerchantLogo({ name, logoPath = null, size = "md", onRemoteLogo, fallback, className }: MerchantLogoProps) {
  const [state, setState] = React.useState<{ src: string | null; status: "pending" | "loaded" | "failed" }>({ src: logoPath, status: "pending" });
  // Un altro esercente nello stesso posto (carte del mazzo): si ricomincia dall'iniziale.
  if (state.src !== logoPath) setState({ src: logoPath, status: "pending" });
  const loaded = logoPath !== null && state.status === "loaded";
  const { tile, text, pad } = SIZE_CLASSES[size];

  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-heading font-semibold",
        tile,
        text,
        // I marchi sono pensati per fondi chiari: il riquadro resta bianco anche nel tema scuro.
        loaded ? "bg-white ring-1 ring-border" : fallback === undefined && "bg-foreground/[0.06] text-text-2",
        className
      )}
    >
      {loaded ? null : (fallback ?? initialOf(name))}
      {logoPath !== null && state.status !== "failed" ? (
        // eslint-disable-next-line @next/next/no-img-element -- immagine dal nostro server, già ridimensionata
        <img
          key={logoPath}
          src={logoPath}
          alt=""
          loading="lazy"
          onLoad={() => {
            setState({ src: logoPath, status: "loaded" });
            onRemoteLogo?.();
          }}
          onError={() => setState({ src: logoPath, status: "failed" })}
          className={cn("absolute inset-0 size-full bg-white object-contain", pad, !loaded && "opacity-0")}
        />
      ) : null}
    </span>
  );
}
