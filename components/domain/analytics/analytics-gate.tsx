"use client";

/** Schermata mostrata a chi non ha attivato gli strumenti avanzati: spiega che cosa sono e permette di accenderli. */

import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { useUpdateUserSettingsMutation } from "@/lib/queries/user-settings";

export function AnalyticsGate() {
  const update = useUpdateUserSettingsMutation();
  return (
    <div className="rounded-xl border border-dashed p-8 text-center">
      <p className="font-heading text-lg font-medium text-foreground">Analitiche è una sezione per chi vuole smanettare</p>
      <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
        Obiettivo FIRE, simulazioni di mercato, regole di prelievo, rischio e costi: strumenti tecnici, tutti spiegati passo passo, pensati per chi ama ragionare sui numeri. Non serve per usare Buddy Budget: resta nascosta finché non la accendi, e la puoi spegnere quando vuoi da Impostazioni.
      </p>
      <Button
        className="mt-4"
        disabled={update.isPending}
        onClick={() => update.mutate({ advancedAnalytics: true }, { onSuccess: () => track("analytics_enabled") })}
      >
        {update.isPending ? "Attivo…" : "Attiva gli strumenti avanzati"}
      </Button>
      {update.isError ? (
        <p className="mt-2 text-sm text-neg" role="alert">
          {update.error.message}
        </p>
      ) : null}
    </div>
  );
}
