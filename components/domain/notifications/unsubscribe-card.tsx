"use client";

/** Scheda della pagina di disiscrizione: un clic per disattivare, senza login. Il token firmato viene dal link dell'email. */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { NOTIFICATION_KIND_INFO, type UnsubscribeScope } from "@/lib/notifications";

export interface UnsubscribeCardProps {
  token: string;
  scope: UnsubscribeScope;
  /** Dove si gestiscono le preferenze (richiede l'accesso). */
  preferencesHref: string;
  /** Indirizzo per chiedere aiuto sulla privacy. */
  privacyEmail: string;
}

type Status = "idle" | "working" | "done" | "error";

const scopeLabel = (scope: UnsubscribeScope) => (scope === "all" ? "tutte le email di riepilogo e avviso" : NOTIFICATION_KIND_INFO[scope].label.toLowerCase());

export function UnsubscribeCard({ token, scope, preferencesHref, privacyEmail }: UnsubscribeCardProps) {
  const [status, setStatus] = React.useState<Status>("idle");

  async function unsubscribe() {
    setStatus("working");
    try {
      const response = await fetch(`/api/email/unsubscribe?t=${encodeURIComponent(token)}&source=page`, { method: "POST" });
      if (!response.ok) throw new Error("request failed");
      setStatus("done");
      track("notifications_unsubscribed", { kind: scope });
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {status === "done" ? (
        <>
          <h1 className="font-heading text-2xl font-medium text-foreground">Fatto, non ti scriviamo più</h1>
          <p className="text-sm text-muted-foreground">
            Abbiamo disattivato {scopeLabel(scope)}. Se è stato un errore, puoi riattivarle quando vuoi da Impostazioni → Notifiche. Le email di
            servizio (per esempio il link di accesso) restano attive: servono a usare l&apos;account.
          </p>
        </>
      ) : (
        <>
          <h1 className="font-heading text-2xl font-medium text-foreground">Vuoi smettere di riceverle?</h1>
          <p className="text-sm text-muted-foreground">
            Disattiviamo {scopeLabel(scope)}. Basta un clic, non serve accedere. Le email di servizio (come il link di accesso) non si possono
            disattivare.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={unsubscribe} disabled={status === "working"}>
              {status === "working" ? "Un attimo…" : "Disattiva queste email"}
            </Button>
            <a href={preferencesHref} className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground">
              Preferisco scegliere cosa ricevere
            </a>
          </div>
          {status === "error" && (
            <p className="text-sm text-neg" role="alert">
              Non siamo riusciti a disattivarle. Riprova tra poco o scrivi a {privacyEmail}.
            </p>
          )}
        </>
      )}
    </div>
  );
}
