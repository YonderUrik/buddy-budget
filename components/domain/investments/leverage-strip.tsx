"use client";

import * as React from "react";
import { ChevronRightIcon } from "lucide-react";
import { track } from "@/lib/analytics";
import { marginCallDrop, type BrokerLeverage } from "@/lib/calc/leverage";
import { localizedFormats } from "@/lib/localization/format";
import { useLocalization } from "@/lib/localization/provider";
import { LeverageDetailsDialog } from "./leverage-details";
import { useMaintenanceMargin } from "./margin-estimate";

export interface LeverageStripProps {
  /** Accounts with a loan today; nothing is drawn without one. */
  accounts: BrokerLeverage[];
  currency: string;
}

/**
 * Navy strip under the portfolio hero, one per broker account that borrows: leverage, loan, own capital, interest of the
 * last 12 months and the estimated fall before a margin call; the round button opens the details.
 */
export function LeverageStrip({ accounts, currency }: LeverageStripProps) {
  const [openId, setOpenId] = React.useState<string | null>(null);
  if (!accounts.length) return null;
  return (
    <>
      <div className="flex flex-col gap-3">
        {accounts.map((account) => (
          <LeverageStripRow key={account.accountId} account={account} currency={currency}
            onOpen={() => { setOpenId(account.accountId); track("investment_leverage_details_opened", {}); }} />
        ))}
      </div>
      <LeverageDetailsDialog account={accounts.find((a) => a.accountId === openId) ?? null} currency={currency} onClose={() => setOpenId(null)} />
    </>
  );
}

function LeverageStripRow({ account, currency, onOpen }: { account: BrokerLeverage; currency: string; onOpen: () => void }) {
  const { t: tr, locale } = useLocalization();
  const { formatCurrency, formatPct, formatRatio } = localizedFormats(locale);
  const [maintenance] = useMaintenanceMargin();
  const drop = marginCallDrop(account.loan, account.securities, maintenance / 100);
  const money = (amount: number) => formatCurrency(amount, currency);
  return (
    <section aria-label={tr("Leva")} className="grid grid-cols-2 items-center gap-x-6 gap-y-4 rounded-2xl bg-brand-navy px-6 py-5 text-on-brand-navy lg:grid-cols-5">
      <div className="col-span-2 flex flex-col lg:col-span-1">
        <span className="font-display text-2xl font-extrabold tabular-nums">
          {account.ratio === null ? tr("Leva") : tr("Leva {0}×", { 0: formatRatio(account.ratio, 2) })}
        </span>
        <span className="text-sm text-on-brand-navy-2">{account.name}</span>
      </div>
      <StripFigure label={tr("Prestito a margine")} value={money(account.loan)} />
      <StripFigure label={tr("Il tuo capitale")} value={money(account.equity)} />
      <StripFigure label={tr("Interessi 12 mesi")} value={money(account.interest.last12Months)}
        note={account.interest.effectiveRate !== null ? formatPct(account.interest.effectiveRate, 1) : undefined} />
      <div className="flex items-center justify-between gap-3">
        <StripFigure label={tr("Margin call se scendono")} value={drop === null ? "—" : drop === 0 ? tr("Al limite") : `−${formatPct(drop, 0)}`} />
        <button type="button" onClick={onOpen} aria-label={tr("Dettagli della leva")}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-sun text-on-sun transition-colors hover:bg-sun-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-brand-navy">
          <ChevronRightIcon className="size-5" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

function StripFigure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="text-sm text-on-brand-navy-2">{label}</span>
      <span className="text-xl font-semibold tabular-nums">
        {value}
        {note ? <span className="ml-1.5 text-sm font-normal text-on-brand-navy-2">{note}</span> : null}
      </span>
    </div>
  );
}
