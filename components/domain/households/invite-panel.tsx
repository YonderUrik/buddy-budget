"use client";

/**
 * Invite someone to a group: by email (the app sends it) or with a link to paste in a chat. On a phone the link opens
 * the share sheet (WhatsApp, Messages...); elsewhere it is copied. Says what happened in one line.
 */

import * as React from "react";
import { CheckIcon, LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocalization } from "@/lib/localization/provider";
import { useCreateInviteMutation } from "@/lib/queries/households";
import { INVITE_TTL_DAYS } from "@/lib/households/constants";

export interface InvitePanelProps {
  householdId: string;
  householdName: string;
  /** Called after an invitation went out (email sent or link shared). */
  onInvited?: () => void;
}

type Outcome = { kind: "email"; email: string; emailed: boolean } | { kind: "link"; shared: boolean } | null;

export function InvitePanel({ householdId, householdName, onInvited }: InvitePanelProps) {
  const { t: tr } = useLocalization();
  const [email, setEmail] = React.useState("");
  const [outcome, setOutcome] = React.useState<Outcome>(null);
  const invite = useCreateInviteMutation(householdId);

  async function sendEmail() {
    const address = email.trim();
    if (!address) return;
    const result = await invite.mutateAsync(address).catch(() => null);
    if (!result) return;
    setOutcome({ kind: "email", email: address, emailed: result.emailed });
    setEmail("");
    onInvited?.();
  }

  async function shareLink() {
    const result = await invite.mutateAsync(null).catch(() => null);
    if (!result) return;
    const text = tr("Gestiamo i soldi insieme su BuddyBudget, nel gruppo «{0}»:", { 0: householdName });
    let shared = false;
    if (typeof navigator !== "undefined" && navigator.share && window.matchMedia("(pointer: coarse)").matches) {
      shared = await navigator.share({ text, url: result.url }).then(() => true, () => false);
    }
    if (!shared) await navigator.clipboard?.writeText(`${text} ${result.url}`).catch(() => undefined);
    setOutcome({ kind: "link", shared });
    onInvited?.();
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Not a <form>: the panel also sits inside the «Nuovo gruppo» form, and forms cannot nest. */}
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <Input
          type="email"
          inputMode="email"
          autoComplete="off"
          placeholder={tr("Email di chi vuoi invitare")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            void sendEmail();
          }}
          className="h-11 flex-1 rounded-full px-4"
          aria-label={tr("Email di chi vuoi invitare")}
        />
        <Button type="button" variant="sun" className="h-11 rounded-full px-5" onClick={sendEmail} disabled={invite.isPending || !email.trim()}>
          {tr("Invia l'invito")}
        </Button>
      </div>
      <Button type="button" variant="secondary" className="h-11 w-fit gap-2 rounded-full px-5" onClick={shareLink} disabled={invite.isPending}>
        <LinkIcon className="size-4" aria-hidden="true" />
        {tr("Manda il link su WhatsApp")}
      </Button>
      {outcome ? (
        <p className="flex items-start gap-2 text-sm text-text-2" role="status">
          <CheckIcon className="mt-0.5 size-4 shrink-0 text-pos" aria-hidden="true" />
          {outcome.kind === "email"
            ? outcome.emailed
              ? tr("Invito mandato a {0}. Vale {1} giorni.", { 0: outcome.email, 1: INVITE_TTL_DAYS })
              : tr("Invito pronto per {0}, ma l'email non è partita: manda il link a mano.", { 0: outcome.email })
            : outcome.shared
              ? tr("Link condiviso. Vale {0} giorni.", { 0: INVITE_TTL_DAYS })
              : tr("Link copiato: incollalo in WhatsApp o dove vuoi. Vale {0} giorni.", { 0: INVITE_TTL_DAYS })}
        </p>
      ) : (
        <p className="text-sm text-text-2">{tr("Il link vale {0} giorni. Chi non ha un account lo crea dal link.", { 0: INVITE_TTL_DAYS })}</p>
      )}
      {invite.isError ? <p className="text-sm text-neg">{invite.error.message}</p> : null}
    </div>
  );
}
