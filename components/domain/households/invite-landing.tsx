"use client";

/**
 * The invitation page (`/invite/<token>`). Signed out: who invites to which group, and «Entra per accettare»; the
 * token is kept on the device, so after a new account's onboarding the app comes back here by itself. Signed in:
 * what the viewer shows the group (the app has already ticked the usual choices) and «Accetta».
 */

import * as React from "react";
import Link from "next/link";
import { AUTH_PRIMARY_BUTTON, AUTH_TITLE } from "@/components/domain/auth/auth-styles";
import { Button, buttonVariants } from "@/components/ui/button";
import type { ShareableAccount } from "@/lib/households/types";
import { useLocalization } from "@/lib/localization/provider";
import { useAcceptInviteMutation, type SharingPayload } from "@/lib/queries/households";
import { cn } from "@/lib/utils";
import { PersonAvatar } from "./person-avatar";
import { initialSharing, SharingChoices } from "./sharing-choices";
import { rememberPendingInvite, forgetPendingInvite } from "./pending-invite";

export interface InviteLandingProps {
  token: string;
  status: "valid" | "expired" | "used" | "missing";
  householdName: string;
  inviterName: string;
  memberNames: string[];
  /** The name the group gave the invited person («Luca»). */
  personName: string;
  /** Expenses already written for them in the group. */
  expenseCount: number;
  /** Signed in: the viewer's accounts for the sharing choice; null when signed out. */
  accounts: ShareableAccount[] | null;
  currency: string;
}

export function InviteLanding({ token, status, householdName, inviterName, memberNames, personName, expenseCount, accounts, currency }: InviteLandingProps) {
  const { t: tr } = useLocalization();
  const accept = useAcceptInviteMutation(token);
  const [sharing, setSharing] = React.useState<SharingPayload | null>(null);
  const signedIn = accounts !== null;

  React.useEffect(() => {
    if (status !== "valid") forgetPendingInvite();
    else if (!signedIn) rememberPendingInvite(token);
  }, [status, signedIn, token]);

  if (status !== "valid") {
    return (
      <div className="flex flex-col gap-5">
        <h1 className={AUTH_TITLE}>{status === "missing" ? tr("Questo invito non esiste") : tr("Questo invito non vale più")}</h1>
        <p className="text-text-2">
          {status === "expired"
            ? tr("Gli inviti valgono pochi giorni. Chiedi a {0} di mandartene uno nuovo dalla pagina del gruppo.", { 0: inviterName })
            : status === "used"
              ? tr("È già stato usato o è stato annullato. Se sei tu ad averlo accettato, trovi il gruppo in Panoramica.")
              : tr("Controlla di aver copiato tutto il link, oppure chiedine uno nuovo.")}
        </p>
        <Link href="/" className={cn(buttonVariants(), AUTH_PRIMARY_BUTTON, "h-12 w-fit px-6")}>
          {tr("Vai a BuddyBudget")}
        </Link>
      </div>
    );
  }

  const value = sharing ?? initialSharing(accounts ?? []);
  const others = memberNames.filter((n) => n !== inviterName);

  async function confirm() {
    const result = await accept.mutateAsync(value).catch(() => null);
    if (!result) return;
    forgetPendingInvite();
    window.location.assign(`/panoramica?group=${result.id}&joined=1`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center">
        <PersonAvatar initial={inviterName.charAt(0).toUpperCase()} slot={1} name={inviterName} size="lg" />
        <PersonAvatar initial={personName ? personName.charAt(0).toUpperCase() : "?"} slot={0} name={tr("Tu")} size="lg" className="-ml-3 ring-4 ring-card" />
      </div>
      <div className="flex flex-col gap-3">
        <h1 className={AUTH_TITLE}>{tr("{0} ti invita in «{1}»", { 0: inviterName, 1: householdName })}</h1>
        <p className="text-text-2">
          {others.length > 0 ? tr("Nel gruppo ci sono già {0} e {1}. ", { 0: inviterName, 1: others.join(", ") }) : ""}
          {tr("Gestite i soldi insieme: ognuno tiene il suo account e vedete solo quello che ciascuno sceglie di mostrare.")}
        </p>
        {personName ? (
          <p className="rounded-2xl bg-foreground/[0.04] px-4 py-3 text-sm">
            {expenseCount > 0
              ? tr("Ti hanno già messo nel gruppo come «{0}», con {1} spese da dividere: entrando prendi il tuo posto e le trovi lì.", { 0: personName, 1: expenseCount })
              : tr("Ti hanno già messo nel gruppo come «{0}»: entrando prendi il tuo posto.", { 0: personName })}
          </p>
        ) : null}
      </div>

      {signedIn ? (
        <>
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">{tr("Cosa vede il gruppo di te")}</h2>
            <p className="text-sm text-text-2">{tr("Ho già messo le scelte più comuni: cambiale se vuoi.")}</p>
          </div>
          <SharingChoices accounts={accounts} value={value} onChange={setSharing} currency={currency} />
          {accept.isError ? <p className="text-sm text-neg">{accept.error.message}</p> : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className={cn(AUTH_PRIMARY_BUTTON, "h-12 px-6")} onClick={confirm} disabled={accept.isPending}>
              {accept.isPending ? tr("Entro nel gruppo…") : tr("Accetta")}
            </Button>
            <Link href="/" onClick={forgetPendingInvite} className={cn(buttonVariants({ variant: "ghost" }), "h-12 rounded-full px-6")}>
              {tr("Non ora")}
            </Link>
          </div>
          <p className="text-sm text-text-3">{tr("Cambi tutto quando vuoi dalla pagina del gruppo, ed esci in un tocco.")}</p>
        </>
      ) : (
        <>
          <ul className="flex flex-col gap-2 text-sm text-text-2">
            <li>{tr("Il tuo patrimonio e i tuoi conti restano tuoi: scegli tu cosa mostrare, dopo essere entrato.")}</li>
            <li>{tr("Ogni spesa si divide tra le persone per cui è stata fatta, e l'app tiene il conto di chi deve cosa.")}</li>
          </ul>
          <Link href={`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`} className={cn(buttonVariants(), AUTH_PRIMARY_BUTTON, "h-12 w-fit px-6")}>
            {tr("Entra o crea un account")}
          </Link>
          <p className="text-sm text-text-3">{tr("Dopo l'accesso torni qui per scegliere cosa mostrare. Se non vuoi un account, il gruppo continua a dividere le spese con te lo stesso.")}</p>
        </>
      )}
    </div>
  );
}
