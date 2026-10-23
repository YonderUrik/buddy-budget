"use client";

/**
 * Who is in a group, and adding people. Someone can be added with just a name: expenses are split with them at once,
 * whether or not they ever sign up; «Invita» sends them a link (email or WhatsApp) to take their place with their own
 * account. Used by the group page and by the last step of «Nuovo gruppo».
 */

import * as React from "react";
import { UserPlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HOUSEHOLD_NAME_MAX, MAX_HOUSEHOLD_MEMBERS } from "@/lib/households/constants";
import type { HouseholdSettings } from "@/lib/households/types";
import { localizedFormats } from "@/lib/localization/format";
import { useLocalization } from "@/lib/localization/provider";
import { useAddPersonMutation, useRemovePersonMutation, useRevokeInviteMutation } from "@/lib/queries/households";
import { cn } from "@/lib/utils";
import { RemovePersonDialog } from "./confirm-dialogs";
import { InvitePanel } from "./invite-panel";
import { PersonAvatar } from "./person-avatar";

type Member = HouseholdSettings["members"][number];

export interface MembersSectionProps {
  householdId: string;
  householdName: string;
  members: readonly Member[];
  /** Hide what each member shows (the «Nuovo gruppo» step, where only the creator is in). */
  compact?: boolean;
}

export function MembersSection({ householdId, householdName, members, compact = false }: MembersSectionProps) {
  const { t: tr, locale } = useLocalization();
  const { formatDateWithYear } = localizedFormats(locale);
  const revoke = useRevokeInviteMutation(householdId);
  const remove = useRemovePersonMutation(householdId);
  const [inviting, setInviting] = React.useState<string | null>(null);
  const [removing, setRemoving] = React.useState<Member | null>(null);

  function status(m: Member): string {
    if (m.userId) {
      if (compact) return m.isMe ? tr("Hai creato il gruppo") : tr("È nel gruppo con il suo account");
      return [
        m.sharesNetWorth ? tr("mostra il patrimonio totale") : tr("non mostra il patrimonio"),
        m.sharedAccounts === 0 ? tr("nessun conto") : m.sharedAccounts === 1 ? tr("1 conto") : tr("{0} conti", { 0: m.sharedAccounts }),
      ].join(" · ");
    }
    if (!m.invite) return tr("Non è su BuddyBudget: dividete le spese lo stesso");
    const until = formatDateWithYear(m.invite.expiresAt.slice(0, 10));
    return m.invite.email ? tr("Invito mandato a {0} · scade il {1}", { 0: m.invite.email, 1: until }) : tr("Link mandato · scade il {0}", { 0: until });
  }

  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col gap-1">
        {members.map((m) => (
          <li key={m.id} className="flex flex-col gap-3 py-1.5">
            {/* On the phone the buttons go under the name, so the status line keeps the whole width. */}
            <div className="flex min-h-14 flex-wrap items-center gap-x-3.5 gap-y-2">
              <PersonAvatar initial={m.initial} slot={m.slot} name={m.name} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{m.isMe ? tr("Tu") : m.name}</span>
                <span className="block text-sm break-words text-text-2">{status(m)}</span>
              </span>
              {m.userId ? null : (
                <span className="flex w-full shrink-0 items-center gap-1 pl-[3.125rem] sm:w-auto sm:pl-0">
                  <Button variant="secondary" className="h-10 rounded-full px-4" onClick={() => setInviting(inviting === m.id ? null : m.id)} aria-expanded={inviting === m.id}>
                    {m.invite ? tr("Di nuovo") : tr("Invita")}
                  </Button>
                  <Button variant="ghost" className="h-10 rounded-full px-3 text-text-2" onClick={() => setRemoving(m)}>
                    {tr("Togli")}
                  </Button>
                </span>
              )}
            </div>
            {inviting === m.id ? (
              <div className="rounded-3xl bg-foreground/[0.04] p-4 sm:ml-[3.125rem]">
                <InvitePanel householdId={householdId} householdName={householdName} memberId={m.id} personName={m.name} />
                {m.invite ? (
                  <Button variant="ghost" className="mt-2 h-10 rounded-full px-3 text-text-2" onClick={() => revoke.mutate(m.invite!.id)} disabled={revoke.isPending}>
                    {tr("Annulla l'invito già mandato")}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {members.length < MAX_HOUSEHOLD_MEMBERS ? <AddPersonForm householdId={householdId} /> : <p className="text-sm text-text-2">{tr("Il gruppo è pieno: al massimo {0} persone.", { 0: MAX_HOUSEHOLD_MEMBERS })}</p>}
      <RemovePersonDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        name={removing?.name ?? ""}
        pending={remove.isPending}
        error={remove.isError ? remove.error.message : null}
        onConfirm={() => removing && remove.mutate(removing.id, { onSuccess: () => setRemoving(null) })}
      />
    </div>
  );
}

/** «Aggiungi una persona»: a name, and an email only to invite them right away. Not a <form> (it can sit in one). */
function AddPersonForm({ householdId }: { householdId: string }) {
  const { t: tr } = useLocalization();
  const add = useAddPersonMutation(householdId);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [done, setDone] = React.useState<string | null>(null);

  async function submit() {
    const person = name.trim();
    if (!person) return;
    const address = email.trim() || null;
    const result = await add.mutateAsync({ name: person, email: address }).catch(() => null);
    if (!result) return;
    setDone(
      address
        ? result.emailed
          ? tr("{0} è nel gruppo e ha un invito via email.", { 0: person })
          : tr("{0} è nel gruppo, ma l'email non è partita: manda il link con «Invita».", { 0: person })
        : tr("{0} è nel gruppo: puoi già dividere le spese. L'invito, se serve, da «Invita».", { 0: person })
    );
    setName("");
    setEmail("");
  }

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    void submit();
  };

  return (
    <div className="flex flex-col gap-3 rounded-3xl bg-foreground/[0.04] p-4 sm:p-5">
      <p className="flex items-center gap-2 font-semibold">
        <UserPlusIcon className="size-4" aria-hidden="true" />
        {tr("Aggiungi una persona")}
      </p>
      <p className="-mt-1 text-sm text-text-2">{tr("Basta il nome: non serve che sia su BuddyBudget. Con l'email le mandiamo anche l'invito.")}</p>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onEnter} maxLength={HOUSEHOLD_NAME_MAX} placeholder={tr("Nome")} aria-label={tr("Nome")} className="h-11 rounded-full bg-card px-4" />
        <Input type="email" inputMode="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={onEnter} placeholder={tr("Email (se vuoi invitarla)")} aria-label={tr("Email")} className="h-11 rounded-full bg-card px-4" />
      </div>
      <Button type="button" variant="sun" className={cn("h-11 w-fit rounded-full px-5")} onClick={submit} disabled={add.isPending || !name.trim()}>
        {email.trim() ? tr("Aggiungi e invita") : tr("Aggiungi")}
      </Button>
      {done ? (
        <p className="text-sm text-text-2" role="status">
          {done}
        </p>
      ) : null}
      {add.isError ? <p className="text-sm text-neg">{add.error.message}</p> : null}
    </div>
  );
}
