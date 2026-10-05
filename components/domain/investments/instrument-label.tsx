/**
 * Nome di uno strumento preceduto dalla sua icona, su una riga: per chip, coppie e testi dove il nome da solo
 * costringe a leggere. Il nome si accorcia con i puntini se manca spazio.
 */

import type { InstrumentType } from "@/lib/db/schema/investments";
import { cn } from "@/lib/utils";
import { InstrumentIcon, type InstrumentIconSize } from "./instrument-icon";

export interface InstrumentLabelProps {
  instrument: { id: string; name: string; type: InstrumentType };
  size?: InstrumentIconSize;
  className?: string;
}

export function InstrumentLabel({ instrument, size = "xs", className }: InstrumentLabelProps) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5 align-middle", className)}>
      <InstrumentIcon type={instrument.type} name={instrument.name} instrumentId={instrument.id} size={size} />
      <span className="truncate">{instrument.name}</span>
    </span>
  );
}
