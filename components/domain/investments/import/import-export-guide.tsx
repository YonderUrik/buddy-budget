/** Istruzioni per ottenere il file da un provider: passi numerati e, sotto, cosa viene importato e cosa no. */

import type { ImportProviderInfo } from "@/lib/investments/import/providers";

export interface ImportExportGuideProps {
  provider: Pick<ImportProviderInfo, "name" | "exportSteps" | "note" | "fileLabel">;
  /** Azioni sotto i passi (per esempio il modello da scaricare per un CSV personale). */
  children?: React.ReactNode;
}

export function ImportExportGuide({ provider, children }: ImportExportGuideProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-foreground">Come ottenere il file da {provider.name}</p>
      <ol className="flex flex-col gap-2">
        {provider.exportSteps.map((step, i) => (
          <li key={step} className="flex gap-2.5 text-sm text-muted-foreground">
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium text-foreground" aria-hidden="true">
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted-foreground">{provider.note}</p>
      {children}
    </div>
  );
}
