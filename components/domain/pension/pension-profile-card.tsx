"use client";

/** Dati del fondo che non cambiano nel tempo: nome e data di prima adesione (decide l'aliquota in uscita). */

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export interface PensionProfileCardProps {
  name: string;
  adhesionDate: string;
  /** Data massima selezionabile per l'adesione (oggi). */
  today: string;
  onChange: (profile: { name: string; adhesionDate: string }) => void;
}

export function PensionProfileCard({ name, adhesionDate, today, onChange }: PensionProfileCardProps) {
  return (
    <Card>
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
          Nome del fondo
          <Input value={name} onChange={(e) => onChange({ name: e.target.value, adhesionDate })} />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
          Prima adesione a una forma pensionistica
          <Input type="date" value={adhesionDate} max={today} onChange={(e) => onChange({ name, adhesionDate: e.target.value })} />
          <span>Conta la prima in assoluto, anche in un&apos;altra azienda: decide l&apos;aliquota in uscita.</span>
        </label>
      </CardContent>
    </Card>
  );
}
