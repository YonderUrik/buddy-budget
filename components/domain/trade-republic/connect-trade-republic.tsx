"use client";
import Link from "next/link";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocalization } from "@/lib/localization/provider";
import { useTradeRepublicLogin } from "@/lib/queries/trade-republic";

/** Clearly labelled BuddyBudget connection form, with TR's own app approval as the second factor. */
export function ConnectTradeRepublic() {
  const { t: tr } = useLocalization();
  const login = useTradeRepublicLogin();
  const id = useId();
  if (login.loading) return <p role="status">{tr("Caricamento…")}</p>;
  if (login.result?.status === "connected") return <div className="space-y-4"><p role="status">{tr("Trade Republic è collegato. Saldo e movimenti vengono importati in background: puoi seguirli nel pannello di sincronizzazione.")}</p><Link href="/liquidita?tab=conti" className="text-primary underline">{tr("Vai ai conti")}</Link></div>;
  return <div className="flex max-w-xl flex-col gap-5">
    <p className="text-sm text-muted-foreground">{tr("Questo modulo è di BuddyBudget. Numero e PIN vengono inviati a Trade Republic solo per accedere e non vengono salvati. Confermi l'accesso nell'app Trade Republic o con il tuo autenticatore.")}</p>
    <p className="text-sm text-muted-foreground">{tr("Importiamo direttamente il saldo e i movimenti del conto in EUR, senza file CSV. Acquisti e vendite di titoli non diventano spese. Puoi aggiornare il conto con Sincronizza ora e scollegarlo quando vuoi.")}</p>
    <p className="text-sm text-muted-foreground">{tr("Il collegamento usa l'interfaccia privata di Trade Republic e può richiedere un nuovo accesso. BuddyBudget usa la sessione solo per leggere i dati; il collegamento non è un consenso Open Banking in sola lettura.")}</p>
    {login.configured === false ? <p role="alert">{tr("Il collegamento Trade Republic non è configurato su questa installazione.")}</p> : null}
    {login.pending ? <>
      <p role="status">{login.result?.needsAuthenticator ? tr("Inserisci il codice del tuo autenticatore.") : tr("Apri l'app Trade Republic e approva l'accesso. Questa pagina si aggiorna da sola.")}</p>
      {login.result?.needsAuthenticator ? <form className="space-y-3" onSubmit={event => {
        event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); const code = String(data.get("code") ?? ""); form.reset(); void login.submit({ action: "verify", code });
      }}>
        <label htmlFor={`${id}-code`} className="text-sm font-medium">{tr("Codice autenticatore")}</label>
        <Input id={`${id}-code`} name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required disabled={login.busy} />
        <Button type="submit" disabled={login.busy}>{tr("Conferma")}</Button>
      </form> : null}
      <Button variant="outline" disabled={login.busy} onClick={() => void login.cancel()}>{tr("Annulla")}</Button>
    </> : <form className="flex flex-col gap-3" onSubmit={event => {
      event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
      const phoneNumber = String(data.get("phoneNumber") ?? "").replace(/\s/g, ""); const pin = String(data.get("pin") ?? "");
      form.reset(); void login.submit({ action: "login", phoneNumber, pin });
    }}>
      <label htmlFor={`${id}-phone`} className="text-sm font-medium">{tr("Numero Trade Republic con prefisso internazionale")}</label>
      <Input id={`${id}-phone`} name="phoneNumber" type="tel" autoComplete="off" placeholder="+49…" pattern="\+[1-9][0-9 ]{6,20}" required disabled={login.busy || login.configured !== true} />
      <label htmlFor={`${id}-pin`} className="text-sm font-medium">{tr("PIN Trade Republic")}</label>
      <Input id={`${id}-pin`} name="pin" type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{4}" minLength={4} maxLength={4} required disabled={login.busy || login.configured !== true} />
      <Button type="submit" disabled={login.busy || login.configured !== true}>{login.busy ? tr("Accesso in corso…") : tr("Accedi e importa il conto")}</Button>
    </form>}
    {login.error ? <p role="alert" className="text-sm text-destructive">{login.error}</p> : null}
  </div>;
}
