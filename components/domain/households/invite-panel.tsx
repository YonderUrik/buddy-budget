"use client";

/**
 * Invite someone added by name to join with their own account: by email (the app sends it) or with a link to paste
 * in a chat. On a phone the link opens the share sheet (WhatsApp, Messages...); elsewhere it is copied. Says what
 * happened in one line. Joining is optional: the group works with them as a name too.
 */

import * as React from "react";
import { CheckIcon, LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { INVITE_TTL_DAYS } from "@/lib/households/constants";
import { useLocalization } from "@/lib/localization/provider";
import { useInviteMemberMutation } from "@/lib/queries/households";

export interface InvitePanelProps {
  householdId: string;
  householdName: string;
  /** The person added by name who gets the invitation. */
  memberId: string;
  personName: string;
  /** Called after an invitation went out (email sent or link shared). */
  onInvited?: () => void;
}

type Outcome = { kind: "email"; email: string; emailed: boolean } | { kind: "link"; shared: boolean } | null;

/** Shares an invitation link: the share sheet on a phone, the clipboard elsewhere. True when the sheet was used. */
export async function shareInviteLink(url: string, text: string): Promise<boolean> {
  let shared = false;
  if (typeof navigator !== "undefined" && navigator.share && window.matchMedia("(pointer: coarse)").matches) {
    shared = await navigator.share({ text, url }).then(() => true, () => false);
  }
  if (!shared) await navigator.clipboard?.writeText(`${text} ${url}`).catch(() => undefined);
  return shared;
}

export function InvitePanel({ householdId, householdName, memberId, personName, onInvited }: InvitePanelProps) {
  const { t: tr } = useLocalization();
  const [email, setEmail] = React.useState("");
  const [outcome, setOutcome] = React.useState<Outcome>(null);
  const invite = useInviteMemberMutation(householdId);

  async function sendEmail() {
    const address = email.trim();
    if (!address) return;
    const result = await invite.mutateAsync({ memberId, email: address }).catch(() => null);
    if (!result) return;
    setOutcome({ kind: "email", email: address, emailed: result.emailed });
    setEmail("");
    onInvited?.();
  }

  async function shareLink() {
    const result = await invite.mutateAsync({ memberId, email: null }).catch(() => null);
    if (!result) return;
    const shared = await shareInviteLink(result.url, tr("Ti ho messo nel gruppo «{0}» su BuddyBudget, per dividere le spese:", { 0: householdName }));
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
          placeholder={tr("Email di {0}", { 0: personName })}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            void sendEmail();
          }}
          className="h-11 rounded-full bg-card px-4 sm:flex-1"
          aria-label={tr("Email di {0}", { 0: personName })}
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
        <p className="text-sm text-text-2">{tr("Con il suo account {0} vede il gruppo e segna le sue spese. Il link vale {1} giorni.", { 0: personName, 1: INVITE_TTL_DAYS })}</p>
      )}
      {invite.isError ? <p className="text-sm text-neg">{invite.error.message}</p> : null}
    </div>
  );
}
