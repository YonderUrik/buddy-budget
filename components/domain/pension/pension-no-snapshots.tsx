/** Fondo senza fotografie: rimanda alla scheda dei dati per inserire i primi valori. */

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

export function PensionNoSnapshots() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 text-center">
        <p className="font-heading text-lg font-medium text-foreground">Mancano i valori del fondo</p>
        <p className="text-sm text-muted-foreground">
          Inserisci contributi netti e controvalore dalla scheda{" "}
          <Link href="/pensione/dati" className="font-medium text-primary underline-offset-2 hover:underline">I tuoi dati</Link>: al resto pensiamo noi.
        </p>
      </CardContent>
    </Card>
  );
}
