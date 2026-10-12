"use client";

/**
 * Logo di un esercente: l'iniziale su un fondo tenue e, se la descrizione corrisponde a un marchio noto (Amazon, Apple,
 * Esselunga...), il logo servito dal nostro server (`/api/merchant-logos/[dominio]`, che lo chiede a Logo.dev). Finché
 * il logo non arriva, o se non c'è, resta l'iniziale. Decorativo: il nome è sempre scritto accanto.
 */

import * as React from "react";
import { merchantLogoDomain } from "@/lib/categorization/merchant-name";
import { cn } from "@/lib/utils";

export type MerchantLogoSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<MerchantLogoSize, { tile: string; text: string; pad: string }> = {
  sm: { tile: "size-9", text: "text-sm", pad: "p-1.5" },
  md: { tile: "size-11", text: "text-base", pad: "p-2" },
  lg: { tile: "size-14", text: "text-xl", pad: "p-2.5" },
};

export interface MerchantLogoProps {
  /** Descrizione o nome dell'esercente. */
  name: string;
  /** `sm` 36 px, `md` 44 px (default), `lg` 56 px. */
  size?: MerchantLogoSize;
  /** Chiamata quando è stato mostrato un logo remoto (serve a chi deve citare la fonte dei loghi). */
  onRemoteLogo?: () => void;
  className?: string;
}

/** Prima lettera o cifra del nome, maiuscola. */
function initialOf(name: string): string {
  const match = name.match(/[\p{L}\p{N}]/u);
  return match ? match[0].toUpperCase() : "·";
}

export function MerchantLogo({ name, size = "md", onRemoteLogo, className }: MerchantLogoProps) {
  const domain = React.useMemo(() => merchantLogoDomain(name), [name]);
  const [state, setState] = React.useState<{ domain: string | null; status: "pending" | "loaded" | "failed" }>({ domain, status: "pending" });
  // Un altro esercente nello stesso posto (carte del mazzo): si ricomincia dall'iniziale.
  if (state.domain !== domain) setState({ domain, status: "pending" });
  const loaded = domain !== null && state.status === "loaded";
  const { tile, text, pad } = SIZE_CLASSES[size];

  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-heading font-semibold",
        tile,
        text,
        // I marchi sono pensati per fondi chiari: il riquadro resta bianco anche nel tema scuro.
        loaded ? "bg-white ring-1 ring-border" : "bg-foreground/[0.06] text-text-2",
        className
      )}
    >
      {loaded ? null : initialOf(name)}
      {domain !== null && state.status !== "failed" ? (
        // eslint-disable-next-line @next/next/no-img-element -- immagine dal nostro server, già ridimensionata
        <img
          key={domain}
          src={`/api/merchant-logos/${encodeURIComponent(domain)}`}
          alt=""
          loading="lazy"
          onLoad={() => {
            setState({ domain, status: "loaded" });
            onRemoteLogo?.();
          }}
          onError={() => setState({ domain, status: "failed" })}
          className={cn("absolute inset-0 size-full bg-white object-contain", pad, !loaded && "opacity-0")}
        />
      ) : null}
    </span>
  );
}
