/** Stato vuoto di Pensione: nessuna fotografia del fondo, rimanda alla scheda dei dati. */

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

export function PensionEmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 text-center">
        <p className="font-heading text-lg font-medium text-foreground">Ancora nessun dato del fondo</p>
        <p className="text-sm text-muted-foreground">
          Inserisci i due numeri che vedi nell&apos;area clienti (contributi netti e controvalore) dalla scheda{" "}
          <Link href="/pensione/dati" className="font-medium text-primary underline-offset-2 hover:underline">I tuoi dati</Link>: al resto pensiamo noi.
        </p>
      </CardContent>
    </Card>
  );
}
