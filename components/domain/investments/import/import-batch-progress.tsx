/** Avanzamento dell'import di più rendiconti: quale è in corso e lo stato di ciascuno. */

import { CheckIcon, CircleDashedIcon, LoaderCircleIcon } from "lucide-react";

export interface ImportBatchProgressProps {
  files: { name: string }[];
  /** Indice (da 0) del file in corso. */
  index: number;
}

export function ImportBatchProgress({ files, index }: ImportBatchProgressProps) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p role="status" className="font-medium text-foreground">
        File {index + 1} di {files.length}: {files[index].name}
      </p>
      <p className="text-muted-foreground">Controlla e conferma un rendiconto alla volta: ognuno viene salvato da solo, quindi se ti fermi quelli già completati restano importati.</p>
      <ol className="flex max-h-28 flex-col gap-1 overflow-y-auto">
        {files.map((file, i) => {
          const Icon = i < index ? CheckIcon : i === index ? LoaderCircleIcon : CircleDashedIcon;
          return (
            <li key={`${file.name}-${i}`} className="flex items-center gap-2 text-muted-foreground">
              <Icon className={i < index ? "size-4 text-pos" : "size-4"} aria-hidden="true" />
              <span className="min-w-0 truncate">{file.name}</span>
              <span className="sr-only">{i < index ? "elaborato" : i === index ? "in corso" : "in attesa"}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
