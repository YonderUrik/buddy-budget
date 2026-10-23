"use client";

/** Conti: the others' accounts shown to the viewer, «In comune con te», each opening its read-only page. */

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AccountAvatar } from "@/components/domain/accounts";
import { SECTION_TITLE } from "@/components/domain/shared";
import { localizedFormats } from "@/lib/localization/format";
import { useLocalization } from "@/lib/localization/provider";
import type { SharedAccountsView } from "@/lib/queries/households";
import type { AccountColor, AccountIcon } from "@/lib/validation/accounts";
import { PersonAvatar } from "./person-avatar";

export interface SharedAccountsSectionProps {
  accounts: SharedAccountsView["withMe"];
  currency: string;
}

export function SharedAccountsSection({ accounts, currency }: SharedAccountsSectionProps) {
  const { t: tr, locale } = useLocalization();
  const { formatCurrency } = localizedFormats(locale);
  if (accounts.length === 0) return null;
  return (
    <section aria-labelledby="shared-with-me" className="flex flex-col gap-2">
      <h2 id="shared-with-me" className={SECTION_TITLE}>{tr("In comune con te")}</h2>
      <p className="-mt-1 mb-1 text-sm text-text-2">{tr("Conti che gli altri ti fanno vedere: non entrano nel tuo patrimonio, li trovi sommati nel gruppo.")}</p>
      <ul className="flex flex-col gap-2">
        {accounts.map((account) => (
          <li key={`${account.householdId}-${account.id}`}>
            <Link
              href={`/groups/${account.householdId}/accounts/${account.id}`}
              className="flex min-h-[4.25rem] items-center gap-3.5 rounded-2xl bg-foreground/[0.04] px-4 py-3 transition-colors hover:bg-foreground/[0.07]"
            >
              <AccountAvatar color={account.color as AccountColor} icon={account.icon as AccountIcon} className="size-11" size={19} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{account.name}</span>
                <span className="flex items-center gap-1.5 text-sm text-text-2">
                  <PersonAvatar initial={account.ownerInitial} slot={account.ownerSlot} name={account.ownerName} size="xs" />
                  <span className="truncate">{tr("Di {0}, in «{1}»", { 0: account.ownerName, 1: account.householdName })}</span>
                </span>
              </span>
              <span className="font-heading text-lg font-semibold tabular-nums">{formatCurrency(account.balance, currency)}</span>
              <ChevronRight className="size-4 shrink-0 text-text-3" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
