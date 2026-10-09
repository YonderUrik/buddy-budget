/** Fondo senza fotografie: rimanda alla scheda dei dati per inserire i primi valori. */

import Link from "next/link";
import { DatabaseIcon } from "lucide-react";
import { PensionSection } from "./pension-section";

export function PensionNoSnapshots() {
  return (
    <PensionSection icon={DatabaseIcon} title="Mancano i valori del fondo" color="var(--primary)">
      <p className="text-sm text-text-2">
        Inserisci contributi netti e controvalore dalla scheda{" "}
        <Link href="/pensione/dati" className="font-semibold text-primary underline-offset-2 hover:underline">I tuoi dati</Link>: al resto pensiamo noi.
      </p>
    </PensionSection>
  );
}
