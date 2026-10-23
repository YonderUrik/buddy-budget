"use client";

/**
 * Quiet invite to groups in Panoramica, for people in no group: one line on what a group does, «Crea un gruppo» and a
 * close button. The caller decides when it shows (it is the same offer as the «gruppo» first step).
 */

import Link from "next/link";
import { UsersRoundIcon, XIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useLocalization } from "@/lib/localization/provider";
import { cn } from "@/lib/utils";

export interface GroupInviteCardProps {
  /** Where «Crea un gruppo» goes. */
  href?: string;
  onCreateClick?: () => void;
  /** «Non mi serve»: hides the invite for good. */
  onDismiss: () => void;
  dismissing?: boolean;
  className?: string;
}

export function GroupInviteCard({ href = "/groups/new", onCreateClick, onDismiss, dismissing = false, className }: GroupInviteCardProps) {
  const { t: tr } = useLocalization();
  return (
    <section aria-labelledby="overview-group-invite" className={cn("flex flex-col gap-3 rounded-3xl bg-foreground/[0.04] p-4 sm:p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <h2 id="overview-group-invite" className="flex items-center gap-2 pt-1.5 font-semibold">
          <UsersRoundIcon className="size-4 shrink-0" aria-hidden="true" />
          {tr("Dividi le spese con qualcuno")}
        </h2>
        <Button type="button" variant="ghost" size="icon" className="-mt-1 -mr-1 size-9 shrink-0 rounded-full" onClick={onDismiss} disabled={dismissing} aria-label={tr("Non mi serve")}>
          <XIcon className="size-4" aria-hidden="true" />
        </Button>
      </div>
      <p className="-mt-1 text-sm text-text-2">{tr("Con chi vivi o con cui viaggi, anche se non è su BuddyBudget: l'app tiene il conto di chi deve cosa.")}</p>
      <Link href={href} onClick={onCreateClick} className={cn(buttonVariants({ variant: "secondary" }), "h-10 w-fit rounded-full px-4")}>
        {tr("Crea un gruppo")}
      </Link>
    </section>
  );
}
