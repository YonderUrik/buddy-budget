"use client";
import { useLocalization } from "@/lib/localization/provider";
/** Fondo senza fotografie: rimanda alla scheda dei dati per inserire i primi valori. */

import Link from "next/link";
import { DatabaseIcon } from "lucide-react";
import { PensionSection } from "./pension-section";

export function PensionNoSnapshots() {
  const { t: tr } = useLocalization();
  return (
    <PensionSection icon={DatabaseIcon} title={tr("Mancano i valori del fondo")} color="var(--primary)">
      <p className="text-sm text-text-2">{tr("Inserisci contributi netti e controvalore dalla scheda")}{" "}
        <Link href="/pensione/dati" className="font-semibold text-primary underline-offset-2 hover:underline">{tr("I tuoi dati")}</Link>{tr(": al resto pensiamo noi.")}</p>
    </PensionSection>
  );
}
