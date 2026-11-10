"use client";
import Link from "next/link";
import { useId } from "react";
import { CheckIcon, Loader2Icon, LockKeyholeIcon, ShieldCheckIcon, SmartphoneIcon, WalletIcon } from "lucide-react";
import { ErrorWithReport } from "@/components/domain/support";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocalization } from "@/lib/localization/provider";
import { useTradeRepublicLogin } from "@/lib/queries/trade-republic";
import { cn } from "@/lib/utils";

const STEPS = ["Accedi", "Approva", "Importa"] as const;
const FIELD_CLASS = "h-11";
const FACTS = [
  { icon: ShieldCheckIcon, text: "Numero e PIN vanno solo a Trade Republic: non li salviamo." },
  { icon: SmartphoneIcon, text: "Approvi tu l'accesso, nell'app Trade Republic." },
  { icon: WalletIcon, text: "Importiamo il conto in EUR e gli investimenti. Scolleghi quando vuoi." },
] as const;

export interface ConnectTradeRepublicProps {
  /** Called by «Fatto» once connected (the dialog closes); without it a link to the accounts is shown. */
  onDone?: () => void;
}

/** Three-step Trade Republic connection (sign in, approve in TR's app, import), with TR's approval as second factor. */
export function ConnectTradeRepublic({ onDone }: ConnectTradeRepublicProps) {
  const { t: tr } = useLocalization();
  const login = useTradeRepublicLogin();
  const id = useId();
  if (login.loading) return <div className="flex min-h-40 items-center justify-center" role="status" aria-label={tr("Caricamento…")}><Loader2Icon className="size-5 animate-spin text-muted-foreground" aria-hidden="true" /></div>;
  const step = login.result?.status === "connected" ? 2 : login.pending ? 1 : 0;
  const disabled = login.busy || login.configured !== true;
  return (
    <div className="flex flex-col gap-5">
      <StepIndicator current={step} />
      {step === 2 ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center" role="status">
          <span className="grid size-14 place-items-center rounded-full bg-pos-soft text-pos" aria-hidden="true"><CheckIcon className="size-7" /></span>
          <p className="text-base font-semibold text-foreground">{tr("Trade Republic è collegato")}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{tr("Importiamo saldo, movimenti e investimenti in background: l'avanzamento resta visibile anche se chiudi.")}</p>
          {onDone ? <Button type="button" className="mt-2 h-11 w-full sm:w-auto sm:px-8" onClick={onDone}>{tr("Fatto")}</Button> : <Link href="/liquidita/conti" className="mt-2 text-sm font-medium text-primary hover:underline">{tr("Vai ai conti")}</Link>}
        </div>
      ) : step === 1 ? (
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary motion-safe:animate-pulse" aria-hidden="true"><SmartphoneIcon className="size-6" /></span>
          {login.result?.needsAuthenticator ? (
            <>
              <p className="text-base font-semibold text-foreground">{tr("Inserisci il codice del tuo autenticatore")}</p>
              <form className="flex w-full max-w-xs flex-col gap-3" onSubmit={(event) => {
                event.preventDefault(); const form = event.currentTarget; const code = String(new FormData(form).get("code") ?? ""); form.reset(); void login.submit({ action: "verify", code });
              }}>
                <label htmlFor={`${id}-code`} className="sr-only">{tr("Codice autenticatore")}</label>
                <Input id={`${id}-code`} name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required disabled={login.busy} placeholder="000000" className={cn(FIELD_CLASS, "text-center text-lg tracking-[0.4em] tabular-nums")} />
                <Button type="submit" className="h-11" disabled={login.busy}>{tr("Conferma")}</Button>
              </form>
            </>
          ) : (
            <>
              <p className="text-base font-semibold text-foreground" role="status">{tr("Approva l'accesso nell'app Trade Republic")}</p>
              <p className="max-w-sm text-sm text-muted-foreground">{tr("Ti è arrivata una notifica sul telefono. Appena la confermi, questa finestra va avanti da sola.")}</p>
              <p className="inline-flex items-center gap-2 text-xs text-muted-foreground"><Loader2Icon className="size-3.5 animate-spin" aria-hidden="true" />{tr("In attesa della conferma…")}</p>
            </>
          )}
          <Button type="button" variant="ghost" className="h-11 text-muted-foreground" disabled={login.busy} onClick={() => void login.cancel()}>{tr("Annulla")}</Button>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-2.5">
            {FACTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-2.5 text-sm text-text-2">
                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                {tr(text)}
              </li>
            ))}
          </ul>
          {login.configured === false ? <p role="alert" className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">{tr("Il collegamento Trade Republic non è configurato su questa installazione.")}</p> : null}
          <form className="flex flex-col gap-4" onSubmit={(event) => {
            event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
            const phoneNumber = String(data.get("phoneNumber") ?? "").replace(/\s/g, ""); const pin = String(data.get("pin") ?? "");
            form.reset(); void login.submit({ action: "login", phoneNumber, pin });
          }}>
            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${id}-phone`} className="text-sm font-medium text-foreground">{tr("Numero di telefono")}</label>
                <Input id={`${id}-phone`} name="phoneNumber" type="tel" autoComplete="off" placeholder="+39 333 123 4567" pattern="\+[1-9][0-9 ]{6,20}" required disabled={disabled} className={FIELD_CLASS} aria-describedby={`${id}-phone-hint`} />
                <span id={`${id}-phone-hint`} className="text-xs text-muted-foreground">{tr("Quello di Trade Republic, con il prefisso.")}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${id}-pin`} className="text-sm font-medium text-foreground">{tr("PIN")}</label>
                <Input id={`${id}-pin`} name="pin" type="password" inputMode="numeric" autoComplete="off" placeholder="••••" pattern="[0-9]{4}" minLength={4} maxLength={4} required disabled={disabled} className={cn(FIELD_CLASS, "tracking-[0.3em] tabular-nums")} />
              </div>
            </div>
            <Button type="submit" className="h-11 gap-2" disabled={disabled}>
              {login.busy ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : <LockKeyholeIcon aria-hidden="true" />}
              {login.busy ? tr("Accesso in corso…") : tr("Accedi a Trade Republic")}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">{tr("Il collegamento usa l'interfaccia privata di Trade Republic e può richiedere un nuovo accesso. BuddyBudget usa la sessione solo per leggere i dati; il collegamento non è un consenso Open Banking in sola lettura.")}</p>
        </>
      )}
      {login.error ? <ErrorWithReport area="collega_banca" error={login.error} /> : null}
    </div>
  );
}

/** «1 Accedi · 2 Approva · 3 Importa», with the done steps ticked. */
function StepIndicator({ current }: { current: number }) {
  const { t: tr } = useLocalization();
  return (
    <ol className="flex items-center gap-2 text-xs font-medium" aria-label={tr("Passaggi")}>
      {STEPS.map((label, index) => {
        const done = index < current || current === STEPS.length - 1;
        const active = index === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-2" aria-current={active ? "step" : undefined}>
            <span className={cn("grid size-6 shrink-0 place-items-center rounded-full tabular-nums", done ? "bg-pos-soft text-pos" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
              {done ? <CheckIcon className="size-3.5" aria-hidden="true" /> : index + 1}
            </span>
            <span className={active || done ? "text-foreground" : "text-muted-foreground"}>{tr(label)}</span>
            {index < STEPS.length - 1 ? <span className="h-px flex-1 bg-border" aria-hidden="true" /> : null}
          </li>
        );
      })}
    </ol>
  );
}
