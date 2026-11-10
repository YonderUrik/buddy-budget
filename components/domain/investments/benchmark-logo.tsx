"use client";

/**
 * Mark of a common index (S&P, MSCI, FTSE, Nasdaq) in a white rounded tile, served by our server
 * (`/api/benchmarks/[id]/logo`). Until it loads, or when there is none, the tile shows the index's short monogram.
 * Decorative: the index name is always written beside it.
 */

import * as React from "react";
import type { BenchmarkSuggestion } from "@/lib/investments/benchmark-suggestions";
import { cn } from "@/lib/utils";

export interface BenchmarkLogoProps {
  suggestion: Pick<BenchmarkSuggestion, "id" | "monogram">;
  /** `md` 40 px for list rows, `lg` 48 px for tiles. */
  size?: "md" | "lg";
  className?: string;
}

const SIZES = { md: "size-10 rounded-xl p-1.5 text-[0.625rem]", lg: "size-12 rounded-2xl p-2 text-xs" } as const;

export function BenchmarkLogo({ suggestion, size = "md", className }: BenchmarkLogoProps) {
  const [state, setState] = React.useState<"pending" | "loaded" | "failed">("pending");
  return (
    <span aria-hidden="true" className={cn("relative grid shrink-0 place-items-center overflow-hidden bg-white font-heading font-semibold text-[color:var(--swatch-indigo)] ring-1 ring-border", SIZES[size], className)}>
      {state === "loaded" ? null : suggestion.monogram}
      {state === "failed" ? null : (
        // eslint-disable-next-line @next/next/no-img-element -- image from our server, already resized
        <img
          src={`/api/benchmarks/${suggestion.id}/logo`}
          alt=""
          loading="lazy"
          onLoad={() => setState("loaded")}
          onError={() => setState("failed")}
          className={cn("absolute inset-0 size-full object-contain", size === "md" ? "p-1.5" : "p-2", state !== "loaded" && "opacity-0")}
        />
      )}
    </span>
  );
}
