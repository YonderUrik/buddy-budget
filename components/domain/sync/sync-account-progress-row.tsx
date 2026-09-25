import { cn } from "@/lib/utils";
import type { SyncJobAccount } from "@/lib/sync-jobs/types";
import { ProgressBar } from "@/components/domain/shared";
import { describeAccountProgress } from "./describe-account-progress";

export interface SyncAccountProgressRowProps {
  account: SyncJobAccount;
  interrupted: boolean;
}

/** Riga del pannello per un singolo conto: nome, stato testuale e barra. */
export function SyncAccountProgressRow({ account, interrupted }: SyncAccountProgressRowProps) {
  const description = describeAccountProgress(account, interrupted);
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-sm font-medium text-foreground">{account.name}</span>
      </div>
      <p
        className={cn(
          "text-xs",
          description.tone === "error" && "text-destructive",
          description.tone === "success" && "text-pos",
          description.tone === "default" && "text-muted-foreground"
        )}
      >
        {description.text}
      </p>
      <ProgressBar state={description.bar} label={`Avanzamento ${account.name}`} />
    </li>
  );
}
