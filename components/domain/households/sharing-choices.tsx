"use client";

/**
 * What a member shows a group: their net worth total (one number) and their accounts one by one. Used when creating
 * a group, when accepting an invitation and on the group page. The caller holds the value; the app's suggestions
 * (accounts that look like money of the house) come already ticked from `initialSharing`.
 */

import { AccountAvatar } from "@/components/domain/accounts";
import { Switch } from "@/components/ui/switch";
import type { ShareableAccount } from "@/lib/households/types";
import { localizedFormats } from "@/lib/localization/format";
import { useLocalization } from "@/lib/localization/provider";
import type { SharingPayload } from "@/lib/queries/households";
import type { AccountColor, AccountIcon } from "@/lib/validation/accounts";

/** The app's proposal: net worth total on, and every account whose name says it holds money of the house. */
export function initialSharing(accounts: readonly ShareableAccount[], current?: { sharesNetWorth: boolean }): SharingPayload {
  if (current) return { sharesNetWorth: current.sharesNetWorth, accountIds: accounts.filter((a) => a.shared).map((a) => a.id) };
  return { sharesNetWorth: true, accountIds: accounts.filter((a) => a.suggested).map((a) => a.id) };
}

export interface SharingChoicesProps {
  accounts: readonly ShareableAccount[];
  value: SharingPayload;
  onChange: (value: SharingPayload) => void;
  currency: string;
  /** Show «sembra un conto di casa» next to the suggested accounts. */
  showSuggestions?: boolean;
}

/** One line: what it is, what the others see, and the switch. */
function Choice({ title, hint, tag, checked, onChange, leading }: { title: string; hint: string; tag?: string; checked: boolean; onChange: (checked: boolean) => void; leading?: React.ReactNode }) {
  return (
    <label className="flex min-h-16 cursor-pointer items-center gap-3.5 py-2.5">
      {leading}
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
          {title}
          {tag ? <span className="rounded-full bg-highlight px-2 py-0.5 text-xs font-semibold text-foreground">{tag}</span> : null}
        </span>
        <span className="block text-sm text-text-2">{hint}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

export function SharingChoices({ accounts, value, onChange, currency, showSuggestions = true }: SharingChoicesProps) {
  const { t: tr, locale } = useLocalization();
  const { formatCurrency } = localizedFormats(locale);
  const toggleAccount = (id: string, on: boolean) =>
    onChange({ ...value, accountIds: on ? [...new Set([...value.accountIds, id])] : value.accountIds.filter((a) => a !== id) });
  return (
    <div className="flex flex-col gap-1">
      <Choice
        title={tr("Il tuo patrimonio totale")}
        hint={tr("Solo il numero, mai il dettaglio di investimenti, debiti e pensione")}
        checked={value.sharesNetWorth}
        onChange={(on) => onChange({ ...value, sharesNetWorth: on })}
      />
      {accounts.map((account) => (
        <Choice
          key={account.id}
          leading={<AccountAvatar color={account.color as AccountColor} icon={account.icon as AccountIcon} className="size-10" size={17} />}
          title={account.name}
          hint={tr("Saldo e movimenti · {0}", { 0: formatCurrency(account.balance, currency) })}
          tag={showSuggestions && account.suggested ? tr("sembra un conto di casa") : undefined}
          checked={value.accountIds.includes(account.id)}
          onChange={(on) => toggleAccount(account.id, on)}
        />
      ))}
      <p className="mt-2 text-sm text-text-2">{tr("Dai conti che tieni per te, il gruppo vede solo le spese che segni «in comune».")}</p>
    </div>
  );
}
