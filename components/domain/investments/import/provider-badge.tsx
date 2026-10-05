/** Badge di un provider di import: il logo se ne abbiamo uno con licenza (`logoSrc`), altrimenti una sigla neutra. */

import { FileSpreadsheetIcon } from "lucide-react";
import type { ImportProviderInfo } from "@/lib/investments/import/providers";
import { cn } from "@/lib/utils";

export interface ProviderBadgeProps {
  provider: Pick<ImportProviderInfo, "id" | "name" | "initials" | "logoSrc" | "logoSrcDark">;
  className?: string;
}

export function ProviderBadge({ provider, className }: ProviderBadgeProps) {
  const themed = Boolean(provider.logoSrc && provider.logoSrcDark);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-10 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg font-heading text-sm font-semibold text-foreground",
        // Un logo ha sfondo chiaro in entrambi i temi (i marchi sono pensati per fondi bianchi); con la variante scura si adatta al tema, senza tessera.
        provider.logoSrc ? (themed ? "" : "bg-white") : "bg-muted",
        className,
      )}
    >
      {provider.logoSrc ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- logo statico piccolo, nessun bisogno dell'ottimizzatore */}
          <img src={provider.logoSrc} alt="" className={cn("size-full object-contain p-1.5", themed && "dark:hidden")} />
          {themed ? (
            // eslint-disable-next-line @next/next/no-img-element -- idem
            <img src={provider.logoSrcDark} alt="" className="hidden size-full object-contain p-1.5 dark:block" />
          ) : null}
        </>
      ) : provider.id === "generic" ? (
        <FileSpreadsheetIcon className="size-5 text-muted-foreground" />
      ) : (
        provider.initials
      )}
    </span>
  );
}
