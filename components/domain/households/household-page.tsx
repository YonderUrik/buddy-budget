"use client";

/**
 * The group page: who is in (also people added by name, with their invitation), adding someone, what the viewer
 * shows the group (changeable at any time), and «Esci dal gruppo». The group's numbers live in Panoramica («Apri in
 * Panoramica») and its expenses in «Spese del gruppo».
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
  useUpdateHouseholdMutation,
  type SharingPayload,
} from "@/lib/queries/households";
import { cn } from "@/lib/utils";
import { balanceHeadline } from "./balance-text";
import { LeaveHouseholdDialog } from "./confirm-dialogs";
import { MembersSection } from "./members-section";
import { peopleNames } from "./people-names";
import { PersonStack } from "./person-avatar";
import { initialSharing, SharingChoices } from "./sharing-choices";

export interface HouseholdPageProps {
  householdId: string;
  currency: string;
}

const sameSharing = (a: SharingPayload, b: SharingPayload) =>
  a.sharesNetWorth === b.sharesNetWorth && a.accountIds.length === b.accountIds.length && a.accountIds.every((id) => b.accountIds.includes(id));

export function HouseholdPage({ householdId, currency }: HouseholdPageProps) {
  const { t: tr, locale } = useLocalization();
  const { formatCurrency } = localizedFormats(locale);
  const money = (n: number) => formatCurrency(n, currency);
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useHouseholdSettingsQuery(householdId);
  const overview = useHouseholdOverviewQuery(householdId, new Date().toISOString().slice(0, 7)).data;
  const update = useUpdateHouseholdMutation(householdId);
  const leave = useLeaveHouseholdMutation(householdId);
  const [draft, setDraft] = React.useState<SharingPayload | null>(null);
  const [leaving, setLeaving] = React.useState(false);

  if (isError) return <LoadError message={tr("Impossibile caricare il gruppo")} onRetry={() => refetch()} />;
  if (isLoading || !data) return <div className="h-96 animate-pulse rounded-3xl bg-muted" aria-busy="true" />;

  const saved = initialSharing(data.mine.accounts, data.mine);
  const value = draft ?? saved;
  const dirty = !sameSharing(value, saved);
  // Only people with an account see anything: those added by name are not told about leaving.
  const others = data.members.filter((m) => !m.isMe && m.userId);

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
        <div className="flex flex-wrap gap-2">
          <Link href={`/panoramica?group=${householdId}`} className={cn(buttonVariants({ variant: "secondary" }), "h-11 w-fit rounded-full px-5")}>
            {tr("Apri in Panoramica")}
          </Link>
          <Link href={`/groups/${householdId}/expenses`} className={cn(buttonVariants({ variant: "secondary" }), "h-11 w-fit rounded-full px-5")}>
            {tr("Spese del gruppo")}
          </Link>
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className={SECTION_TITLE}>{tr("Chi c'è")}</h2>
        <MembersSection householdId={householdId} householdName={data.name} members={data.members} />
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
            : tr("Sei l'unico con un account: uscendo il gruppo sparisce, con le spese scritte dentro.")}
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
