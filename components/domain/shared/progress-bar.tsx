import { cn } from "@/lib/utils";

export type ProgressBarState =
  | { kind: "none" }
  | { kind: "indeterminate" }
  | { kind: "determinate"; value: number; max: number };

export interface ProgressBarProps {
  state: ProgressBarState;
  /** Etichetta accessibile della barra (es. il nome del conto). */
  label: string;
  className?: string;
}

/** Barra di avanzamento sottile: determinata (con aria-valuenow) o indeterminata (pulsante, solo se il movimento è consentito). */
export function ProgressBar({ state, label, className }: ProgressBarProps) {
  if (state.kind === "none") return null;

  if (state.kind === "indeterminate") {
    return (
      <div
        role="progressbar"
        aria-label={label}
        aria-busy="true"
        className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
      >
        <div className="h-full w-full rounded-full bg-primary/50 motion-safe:animate-pulse" />
      </div>
    );
  }

  const percent = Math.min(100, Math.round((state.value / state.max) * 100));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={state.max}
      aria-valuenow={state.value}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className="h-full rounded-full bg-primary motion-safe:transition-[width] motion-safe:duration-300"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
