/** Badge di un provider di import: il logo se ne abbiamo uno con licenza (`logoSrc`), altrimenti una sigla neutra. */

import { FileSpreadsheetIcon } from "lucide-react";
import type { ImportProviderInfo } from "@/lib/investments/import/providers";
import { cn } from "@/lib/utils";

export interface ProviderBadgeProps {
  provider: Pick<ImportProviderInfo, "id" | "name" | "initials" | "logoSrc">;
  className?: string;
}

export function ProviderBadge({ provider, className }: ProviderBadgeProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted font-heading text-sm font-semibold text-foreground",
        className,
      )}
    >
      {provider.logoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element -- logo statico piccolo, nessun bisogno dell'ottimizzatore
        <img src={provider.logoSrc} alt="" className="size-full object-contain p-1.5" />
      ) : provider.id === "generic" ? (
        <FileSpreadsheetIcon className="size-5 text-muted-foreground" />
      ) : (
        provider.initials
      )}
    </span>
  );
}
