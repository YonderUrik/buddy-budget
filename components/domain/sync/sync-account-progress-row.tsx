import { TextShimmer } from "@/components/motion";
import { cn } from "@/lib/utils";
import type { SyncJobAccount } from "@/lib/sync-jobs/types";
import { describeAccountProgress } from "./describe-account-progress";

export interface SyncAccountProgressRowProps {
  account: SyncJobAccount;
  interrupted: boolean;
}

/** Fasi in cui il conto sta lavorando: il testo luccica finché non arriva un esito. */
const WORKING_PHASES = new Set<SyncJobAccount["phase"]>(["balance", "fetching", "saving"]);

/**
 * Riga dell'isola dei sync per un singolo conto: nome, stato testuale (che luccica mentre lavora) e barra sottile.
 * Pensata per lo sfondo scuro dell'isola: usa i colori invertiti del tema.
 */
export function SyncAccountProgressRow({ account, interrupted }: SyncAccountProgressRowProps) {
  const description = describeAccountProgress(account, interrupted);
  const working = WORKING_PHASES.has(account.phase) && !interrupted;
  const bar = description.bar;
  const percent = bar.kind === "determinate" ? Math.min(100, Math.round((bar.value / bar.max) * 100)) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="truncate text-sm font-medium">{account.name}</span>
      {working ? (
        <TextShimmer className="text-xs">{description.text}</TextShimmer>
      ) : (
        <p
          className={cn(
            "text-xs",
            description.tone === "error" && "text-neg",
            description.tone === "success" && "text-foreground",
            description.tone === "default" && "text-muted-foreground"
          )}
        >
          {description.text}
        </p>
      )}
      {bar.kind === "none" ? null : (
        <div
          role="progressbar"
          aria-label={`Avanzamento ${account.name}`}
          aria-valuemin={bar.kind === "determinate" ? 0 : undefined}
          aria-valuemax={bar.kind === "determinate" ? bar.max : undefined}
          aria-valuenow={bar.kind === "determinate" ? bar.value : undefined}
          aria-busy={bar.kind === "indeterminate" ? true : undefined}
          className="h-1 w-full overflow-hidden rounded-full bg-muted-foreground/25"
        >
          <div
            className={cn(
              "h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500",
              description.tone === "success" ? "bg-pos" : "bg-foreground",
              bar.kind === "indeterminate" && "w-full opacity-50 motion-safe:animate-pulse"
            )}
            style={bar.kind === "determinate" ? { width: `${percent}%` } : undefined}
          />
        </div>
      )}
    </div>
  );
}
