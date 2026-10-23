"use client";

/** Settings › Gruppi: the viewer's groups (members, pending invitations) and «Nuovo gruppo». */

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { LoadError } from "@/components/domain/shared";
import { useLocalization } from "@/lib/localization/provider";
import { useHouseholdsQuery } from "@/lib/queries/households";
import { NewHouseholdButton } from "./new-household-flow";
import { peopleNames } from "./people-names";
import { PersonStack } from "./person-avatar";

export function HouseholdsSettingsSection() {
  const { t: tr } = useLocalization();
  const { data, isLoading, isError, refetch } = useHouseholdsQuery();
  if (isError) return <LoadError message={tr("Impossibile caricare i gruppi")} onRetry={() => refetch()} />;
  if (isLoading) return <div className="h-40 animate-pulse rounded-2xl bg-muted" aria-busy="true" />;
  const groups = data ?? [];
  return (
    <div className="flex flex-col gap-5">
      {groups.length === 0 ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-foreground/[0.04] p-5">
          <p className="font-semibold">{tr("Gestisci i soldi con chi vive con te")}</p>
          <p className="text-sm text-text-2">
            {tr("Ognuno tiene il suo account e vedete insieme solo quello che scegliete. In Panoramica trovate il patrimonio del gruppo, le spese in comune e chi deve quanto a chi.")}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {groups.map((group) => (
            <li key={group.id}>
              <Link href={`/groups/${group.id}`} className="flex min-h-[4.25rem] items-center gap-3.5 rounded-2xl bg-foreground/[0.04] px-4 py-3 transition-colors hover:bg-foreground/[0.07]">
                <PersonStack people={group.members} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{group.name}</span>
                  <span className="block truncate text-sm text-text-2">
                    {peopleNames(group.members, tr)}
                    {group.pendingInvites > 0 ? ` · ${group.pendingInvites === 1 ? tr("1 invito in attesa") : tr("{0} inviti in attesa", { 0: group.pendingInvites })}` : ""}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-text-3" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <NewHouseholdButton className="w-fit" />
    </div>
  );
}
