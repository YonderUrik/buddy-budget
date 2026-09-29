"use client";

/**
 * DeactivatedAccountPanel
 *
 * Mostrato a chi accede con un account disattivato: data di eliminazione definitiva, "Riattiva account" (che
 * annulla l'eliminazione) oppure "Esci". È l'unica pagina raggiungibile finché l'account resta disattivato.
 */

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { track } from "@/lib/analytics";
import { formatLongDate } from "@/lib/format";
import { useReactivateAccountMutation } from "@/lib/queries/user-settings";

export interface DeactivatedAccountPanelProps {
  /** Data (ISO) dell'eliminazione definitiva. */
  deletionScheduledAt: string;
  /** Dove andare dopo la riattivazione. Default: la home (pagina iniziale dell'utente). */
  afterReactivate?: string;
}

export function DeactivatedAccountPanel({ deletionScheduledAt, afterReactivate = "/" }: DeactivatedAccountPanelProps) {
  const reactivate = useReactivateAccountMutation();
  const [signingOut, setSigningOut] = React.useState(false);

  async function signOut() {
    setSigningOut(true);
    await authClient.signOut().catch(() => undefined);
    window.location.assign("/login");
  }

  return (
    <div className="flex flex-col gap-8 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-medium tracking-tight">Il tuo account è disattivato</h1>
        <p className="text-text-2">
          {`Il ${formatLongDate(new Date(deletionScheduledAt))} l'account e tutti i tuoi dati verranno eliminati per sempre. `}
          Fino ad allora puoi riattivarlo e ritrovare tutto com&apos;era.
        </p>
      </div>

      {reactivate.isError && (
        <p className="rounded-lg bg-neg-soft p-3 text-sm text-neg" role="alert">
          {reactivate.error.message}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <Button
          type="button"
          className="h-11 w-full text-base"
          disabled={reactivate.isPending || signingOut}
          onClick={() =>
            reactivate.mutate(undefined, {
              onSuccess: () => {
                track("account_reactivated");
                window.location.assign(afterReactivate);
              },
            })
          }
        >
          {reactivate.isPending && <Loader2 className="size-5 animate-spin" aria-hidden="true" />}
          Riattiva account
        </Button>
        <Button type="button" variant="outline" className="h-11 w-full text-base" disabled={signingOut} onClick={signOut}>
          {signingOut && <Loader2 className="size-5 animate-spin" aria-hidden="true" />}
          Esci
        </Button>
      </div>
    </div>
  );
}
