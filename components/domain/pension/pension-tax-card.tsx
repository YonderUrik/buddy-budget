/** Scheda "quando scende l'aliquota": la linea del tempo dell'aliquota in uscita con la spiegazione. */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PensionTaxTimeline } from "./pension-tax-timeline";

export interface PensionTaxCardProps {
  adhesionDate: string;
  today: string;
}

export function PensionTaxCard({ adhesionDate, today }: PensionTaxCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quando l&apos;aliquota scende</CardTitle>
        <p className="text-sm text-muted-foreground">Sui contributi dal 2007 l&apos;imposta in uscita è il 15%, ridotta di 0,30 punti per ogni anno oltre il quindicesimo di partecipazione, fino al 9%. Conta dalla prima adesione.</p>
      </CardHeader>
      <CardContent>
        <PensionTaxTimeline adhesionDate={adhesionDate} today={today} />
      </CardContent>
    </Card>
  );
}
