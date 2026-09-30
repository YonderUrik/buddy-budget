"use client";

/**
 * Card "Commento" scritta da un modello locale (Ollama) a partire dai soli dati pubblici del titolo. Compare solo se il
 * server ha un modello collegato; il commento si genera su richiesta e ricorda che non è un consiglio.
 */

import { SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCommentaryMutation } from "@/lib/queries/titles";

export interface TitleCommentaryCardProps {
  instrumentId: string;
}

export function TitleCommentaryCard({ instrumentId }: TitleCommentaryCardProps) {
  const commentary = useCommentaryMutation(instrumentId);
  const text = commentary.data?.text ?? null;
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Commento</CardTitle>
        <Button variant="outline" size="sm" className="gap-1.5" disabled={commentary.isPending} onClick={() => commentary.mutate()}>
          <SparklesIcon size={14} aria-hidden="true" />
          {commentary.isPending ? "Sto scrivendo…" : text ? "Riscrivi" : "Genera commento"}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {text ? (
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{text}</p>
        ) : commentary.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {commentary.error.message}
          </p>
        ) : commentary.data && commentary.data.available && !text ? (
          <p className="text-sm text-muted-foreground">Il modello non ha risposto. Riprova tra poco.</p>
        ) : (
          <p className="text-sm text-muted-foreground">Un riassunto in parole semplici di come è andato il titolo, scritto da un modello in esecuzione sul server.</p>
        )}
        <p className="text-xs text-muted-foreground">
          Generato automaticamente da dati di prezzo e numeri chiave: può sbagliare e non è una raccomandazione di investimento.
        </p>
      </CardContent>
    </Card>
  );
}
