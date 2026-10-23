"use client";

/**
 * The group page: who is in and who is invited, invite someone else, what the viewer shows the group (changeable at
 * any time), and «Esci dal gruppo». The group's numbers live in Panoramica («Apri in Panoramica»).
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LoadError, PAGE_TITLE, SECTION_TITLE } from "@/components/domain/shared";
import { Button, buttonVariants } from "@/components/ui/button";
import { localizedFormats } from "@/lib/localization/format";
import { useLocalization } from "@/lib/localization/provider";
import {
  useHouseholdOverviewQuery,
  useHouseholdSettingsQuery,
  useLeaveHouseholdMutation,
  useRevokeInviteMutation,
  useUpdateHouseholdMutation,
  type SharingPayload,
} from "@/lib/queries/households";
import { cn } from "@/lib/utils";
import { balanceHeadline } from "./balance-text";
import { LeaveHouseholdDialog } from "./confirm-dialogs";
import { InvitePanel } from "./invite-panel";
import { peopleNames } from "./people-names";
import { PersonAvatar, PersonStack } from "./person-avatar";
import { initialSharing, SharingChoices } from "./sharing-choices";

export interface HouseholdPageProps {
  householdId: string;
  currency: string;
}

const sameSharing = (a: SharingPayload, b: SharingPayload) =>
  a.sharesNetWorth === b.sharesNetWorth && a.accountIds.length === b.accountIds.length && a.accountIds.every((id) => b.accountIds.includes(id));

export function HouseholdPage({ householdId, currency }: HouseholdPageProps) {
  const { t: tr, locale } = useLocalization();
  const { formatCurrency, formatDateWithYear } = localizedFormats(locale);
  const money = (n: number) => formatCurrency(n, currency);
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useHouseholdSettingsQuery(householdId);
  const overview = useHouseholdOverviewQuery(householdId, new Date().toISOString().slice(0, 7)).data;
  const update = useUpdateHouseholdMutation(householdId);
  const revoke = useRevokeInviteMutation(householdId);
  const leave = useLeaveHouseholdMutation(householdId);
  const [draft, setDraft] = React.useState<SharingPayload | null>(null);
  const [leaving, setLeaving] = React.useState(false);

  if (isError) return <LoadError message={tr("Impossibile caricare il gruppo")} onRetry={() => refetch()} />;
  if (isLoading || !data) return <div className="h-96 animate-pulse rounded-3xl bg-muted" aria-busy="true" />;

  const saved = initialSharing(data.mine.accounts, data.mine);
  const value = draft ?? saved;
  const dirty = !sameSharing(value, saved);
  const others = data.members.filter((m) => !m.isMe);

  async function save() {
    await update.mutateAsync({ sharing: value });
    setDraft(null);
    toast.success(tr("Fatto: il gruppo vede le tue nuove scelte"));
  }

  async function confirmLeave() {
    await leave.mutateAsync();
    toast.success(tr("Sei uscito da «{0}»", { 0: data!.name }));
    router.push("/impostazioni?sezione=gruppi");
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-10">
      <header className="flex flex-col gap-3">
        <PersonStack people={data.members} size="lg" />
        <h1 className={PAGE_TITLE}>{data.name}</h1>
        <p className="text-text-2">{peopleNames(data.members, tr)}</p>
        <Link href={`/panoramica?group=${householdId}`} className={cn(buttonVariants({ variant: "secondary" }), "h-11 w-fit rounded-full px-5")}>
          {tr("Apri in Panoramica")}
        </Link>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className={SECTION_TITLE}>{tr("Chi c'è")}</h2>
        <ul className="flex flex-col gap-1">
          {data.members.map((m) => (
            <li key={m.userId} className="flex min-h-14 items-center gap-3.5 py-1.5">
              <PersonAvatar initial={m.initial} slot={m.slot} name={m.name} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{m.isMe ? tr("Tu") : m.name}</span>
                <span className="block text-sm text-text-2">
                  {[
                    m.sharesNetWorth ? tr("mostra il patrimonio totale") : tr("non mostra il patrimonio"),
                    m.sharedAccounts === 0 ? tr("nessun conto") : m.sharedAccounts === 1 ? tr("1 conto") : tr("{0} conti", { 0: m.sharedAccounts }),
                  ].join(" · ")}
                </span>
              </span>
            </li>
          ))}
          {data.invites.map((invite) => (
            <li key={invite.id} className="flex min-h-14 items-center gap-3.5 py-1.5">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-sm text-text-3">?</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{invite.email ? tr("In attesa di {0}", { 0: invite.email }) : tr("Link in attesa")}</span>
                <span className="block text-sm text-text-2">{tr("Scade il {0}", { 0: formatDateWithYear(invite.expiresAt.slice(0, 10)) })}</span>
              </span>
              <Button variant="ghost" className="h-10 rounded-full px-3" onClick={() => revoke.mutate(invite.id)} disabled={revoke.isPending}>
                {tr("Annulla")}
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={SECTION_TITLE}>{tr("Invita qualcun altro")}</h2>
        <InvitePanel householdId={householdId} householdName={data.name} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={SECTION_TITLE}>{tr("Cosa fai vedere")}</h2>
        <SharingChoices accounts={data.mine.accounts} value={value} onChange={setDraft} currency={currency} showSuggestions={false} />
        <div className={cn("flex gap-2 transition-opacity", dirty ? "opacity-100" : "pointer-events-none opacity-0")} aria-hidden={!dirty}>
          <Button variant="sun" className="h-11 rounded-full px-5" onClick={save} disabled={update.isPending}>
            {tr("Salva")}
          </Button>
          <Button variant="ghost" className="h-11 rounded-full px-4" onClick={() => setDraft(null)}>
            {tr("Annulla")}
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={cn(SECTION_TITLE, "text-neg")}>{tr("Esci dal gruppo")}</h2>
        <p className="text-sm text-text-2">
          {others.length > 0
            ? tr("{0} smette subito di vedere quello che fai vedere tu, e tu il suo. I tuoi dati restano tuoi.", { 0: peopleNames(others.map((o) => ({ ...o, isMe: false })), tr) })
            : tr("Sei l'unico nel gruppo: uscendo il gruppo sparisce.")}
        </p>
        <Button variant="outline" className="h-11 w-fit rounded-full px-5 text-neg" onClick={() => setLeaving(true)}>
          {tr("Esci da «{0}»", { 0: data.name })}
        </Button>
      </section>

      <LeaveHouseholdDialog
        open={leaving}
        onOpenChange={setLeaving}
        name={data.name}
        last={others.length === 0}
        pendingBalance={overview && Math.abs(overview.balance.mine) >= 0.005 ? balanceHeadline(overview.balance.mine, overview.balance.transfers, overview.members, money, tr) : null}
        pending={leave.isPending}
        error={leave.isError ? leave.error.message : null}
        onConfirm={confirmLeave}
      />
    </div>
  );
}
