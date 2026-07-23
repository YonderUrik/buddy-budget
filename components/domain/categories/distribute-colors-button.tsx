"use client";

/** Pulsante con conferma che riassegna un colore univoco a ogni categoria non-fallback. */

import * as React from "react";
import { Shuffle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useDistributeColorsMutation } from "@/lib/queries/categories";

export function DistributeColorsButton() {
  const [open, setOpen] = React.useState(false);
  const mutation = useDistributeColorsMutation();

  function handleConfirm() {
    mutation.mutate(undefined, {
      onSuccess: () => setOpen(false),
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Shuffle size={14} />
            Distribuisci colori
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Distribuire i colori automaticamente?</AlertDialogTitle>
          <AlertDialogDescription>
            Ogni categoria (esclusa &quot;Da categorizzare&quot;) riceverà un colore diverso dalle altre.
            I colori attualmente assegnati manualmente verranno sovrascritti.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {mutation.isError && (
          <p className="text-sm text-destructive">Distribuzione non riuscita, riprova.</p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Annulla</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={mutation.isPending}>
            {mutation.isPending ? "Distribuzione..." : "Distribuisci"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
