"use client";

import { ScaleIcon } from "lucide-react";
import type { BrokerLeverage } from "@/lib/calc/leverage";
import { localizedFormats } from "@/lib/localization/format";
import { useLocalization } from "@/lib/localization/provider";
import { MarginEstimate } from "./margin-estimate";
import { PanelSection } from "./panel-section";

export interface LeverageCardProps {
  accounts: BrokerLeverage[];
  currency: string;
}

/** Leverage of each broker account: securities against the margin loan, the own capital, the interest paid and how far the securities can fall. */
export function LeverageCard({ accounts, currency }: LeverageCardProps) {
  const { t: tr } = useLocalization();
  if (!accounts.length) return null;
  return (
    <PanelSection icon={ScaleIcon} title={tr("Leva")} color="var(--swatch-orange)"
      description={tr("Il prestito a margine del broker. Titoli ai prezzi di oggi, saldi e interessi dall'ultimo rendiconto importato.")}>
      <div className="flex flex-col gap-6">
        {accounts.map((account) => <LeverageAccount key={account.accountId} account={account} currency={currency} showName={accounts.length > 1} />)}
      </div>
    </PanelSection>
  );
}

function LeverageAccount({ account, currency, showName }: { account: BrokerLeverage; currency: string; showName: boolean }) {
  const { t: tr, locale } = useLocalization();
  const { formatCurrency, formatDateWithYear, formatPct, formatRatio } = localizedFormats(locale);
  const money = (amount: number, code = currency) => formatCurrency(amount, code);
  const { interest } = account;
  return (
    <div className="flex flex-col gap-3">
      {showName ? <p className="font-medium">{account.name}</p> : null}
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="font-heading text-3xl font-semibold tabular-nums">{account.ratio === null ? "—" : `${formatRatio(account.ratio, 2)}×`}</span>
        <span className="text-sm text-text-2">
          {account.loanToValue === null ? tr("Nessun titolo nel conto") : tr("Prestito pari al {0} dei titoli", { 0: formatPct(account.loanToValue, 0) })}
        </span>
      </div>
      <dl className="text-sm">
        <div className="flex justify-between gap-4 py-2"><dt>{tr("Titoli")}</dt><dd className="tabular-nums">{money(account.securities)}</dd></div>
        <div className="flex justify-between gap-4 py-2"><dt>{account.loan > 0 ? tr("Prestito a margine") : tr("Liquidità nel conto")}</dt><dd className={account.loan > 0 ? "tabular-nums text-neg" : "tabular-nums"}>{money(account.loan > 0 ? -account.loan : account.netCash)}</dd></div>
        <div className="flex justify-between gap-4 py-2 font-medium"><dt>{tr("Il tuo capitale")}</dt><dd className="font-heading text-base tabular-nums">{money(account.equity)}</dd></div>
      </dl>
      {account.balances.length > 1 || account.balances.some((b) => b.currency !== currency) ? (
        <p className="text-sm text-text-2">
          {tr("Saldi per valuta al {0}:", { 0: formatDateWithYear(account.statementDate) })}{" "}
          {account.balances.map((b) => money(b.amount, b.currency)).join(" · ")}
        </p>
      ) : (
        <p className="text-sm text-text-2">{tr("Saldo al {0}", { 0: formatDateWithYear(account.statementDate) })}</p>
      )}
      {interest.byYear.length ? (
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-medium">{tr("Interessi pagati sul prestito")}</p>
          <dl>
            {interest.byYear.map((y) => <div key={y.year} className="flex justify-between gap-4 py-1"><dt>{y.year}</dt><dd className="tabular-nums">{money(y.amount)}</dd></div>)}
          </dl>
          {interest.effectiveRate !== null ? (
            <p className="text-text-2">{tr("Ultimi 12 mesi: {0}, un tasso effettivo del {1} sul prestito medio di {2}.", { 0: money(interest.last12Months), 1: formatPct(interest.effectiveRate, 1), 2: money(interest.averageBorrowed) })}</p>
          ) : null}
        </div>
      ) : null}
      <MarginEstimate loan={account.loan} securities={account.securities} />
      {account.missingFx ? <p className="text-xs text-muted-foreground">{tr("Manca il cambio di una valuta: quel saldo non è contato.")}</p> : null}
    </div>
  );
}
