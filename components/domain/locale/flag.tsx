import { useId } from "react";

import { cn } from "@/lib/utils";

/** Flags drawn by the app (emoji flags show as two letters on Windows). */
export type FlagCode = "IT" | "DE" | "GB";

export type FlagSize = "sm" | "md" | "lg";

export interface FlagProps {
  code: FlagCode;
  /** sm 14×10 (inline text), md 20×14 (fields), lg 24×16 (lists). */
  size?: FlagSize;
  className?: string;
}

// Inline sizes, so parents that size every svg (e.g. `[&_svg]:size-4` in Select) cannot squash the 3:2 shape.
const FLAG_SIZES: Record<FlagSize, { width: number; height: number }> = { sm: { width: 14, height: 10 }, md: { width: 20, height: 14 }, lg: { width: 24, height: 16 } };

// Flag colours are part of the flag itself, not of the theme: they stay the same in light and dark mode.
const IT = ["#009246", "#ffffff", "#ce2b37"] as const;
const DE = ["#000000", "#dd0000", "#ffce00"] as const;
const GB = { blue: "#012169", red: "#c8102e", white: "#ffffff" } as const;

/** Small 3:2 flag with rounded corners and a hairline ring, so white stripes stay visible on light backgrounds. */
export function Flag({ code, size = "md", className }: FlagProps) {
  const id = useId();
  return (
    <svg viewBox="0 0 30 20" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={FLAG_SIZES[size]} className={cn("shrink-0 overflow-hidden rounded-[3px] ring-1 ring-foreground/15", className)}>
      {code === "IT" && IT.map((fill, index) => <rect key={fill} x={index * 10} width="10" height="20" fill={fill} />)}
      {code === "DE" && DE.map((fill, index) => <rect key={fill} y={(index * 20) / 3} width="30" height={20 / 3 + 0.01} fill={fill} />)}
      {code === "GB" && (
        // Union Jack on a 60×30 grid, scaled into the 3:2 box and cropped at the sides.
        <g transform="translate(-5 0) scale(0.6667)">
          <clipPath id={`${id}-t`}>
            <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
          </clipPath>
          <rect width="60" height="30" fill={GB.blue} />
          <path d="M0,0 L60,30 M60,0 L0,30" stroke={GB.white} strokeWidth="6" />
          <path d="M0,0 L60,30 M60,0 L0,30" clipPath={`url(#${id}-t)`} stroke={GB.red} strokeWidth="4" />
          <path d="M30,0 v30 M0,15 h60" stroke={GB.white} strokeWidth="10" />
          <path d="M30,0 v30 M0,15 h60" stroke={GB.red} strokeWidth="6" />
        </g>
      )}
    </svg>
  );
}
