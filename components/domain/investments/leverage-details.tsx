"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { BrokerLeverage } from "@/lib/calc/leverage";
import { localizedFormats } from "@/lib/localization/format";
import { useLocalization } from "@/lib/localization/provider";
import { MarginEstimate } from "./margin-estimate";

export interface LeverageDetailsDialogProps {
  /** The account to show; null keeps the dialog closed. */
  account: BrokerLeverage | null;
  currency: string;
  onClose: () => void;
}

/**
 * Details behind the leverage strip: securities − loan = own capital, the balances by currency of the last statement,
 * the interest by year with the effective rate, and the margin estimate with its maintenance slider.
 */
export function LeverageDetailsDialog({ account, currency, onClose }: LeverageDetailsDialogProps) {
  const { t: tr, locale } = useLocalization();
  const { formatCurrency, formatDateWithYear, formatPct } = localizedFormats(locale);
  const money = (amount: number, code = currency) => formatCurrency(amount, code);
  return (
    <Dialog open={account !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {account ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">{tr("Prestito a margine")}</DialogTitle>
              <DialogDescription>
                {tr("{0}: titoli ai prezzi di oggi, saldi e interessi dal rendiconto del {1}.", { 0: account.name, 1: formatDateWithYear(account.statementDate) })}
              </DialogDescription>
            </DialogHeader>
            <dl className="text-sm">
              <div className="flex justify-between gap-4 py-1.5"><dt>{tr("Titoli")}</dt><dd className="tabular-nums">{money(account.securities)}</dd></div>
              <div className="flex justify-between gap-4 py-1.5"><dt>{tr("− Prestito")}</dt><dd className="tabular-nums text-neg">{money(account.loan)}</dd></div>
              <div className="flex justify-between gap-4 py-1.5 font-semibold"><dt>{tr("= Il tuo capitale")}</dt><dd className="tabular-nums">{money(account.equity)}</dd></div>
            </dl>
            {account.balances.length ? (
              <div className="flex flex-col gap-1 text-sm">
                <p className="font-medium">{tr("Saldi per valuta")}</p>
                <dl>
                  {account.balances.map((b) => (
                    <div key={b.currency} className="flex justify-between gap-4 py-1"><dt>{b.currency}</dt><dd className={b.amount < 0 ? "tabular-nums text-neg" : "tabular-nums"}>{money(b.amount, b.currency)}</dd></div>
                  ))}
                </dl>
              </div>
            ) : null}
            {account.interest.byYear.length ? (
              <div className="flex flex-col gap-1 text-sm">
                <p className="font-medium">{tr("Interessi pagati sul prestito")}</p>
                <dl>
                  {account.interest.byYear.map((y) => <div key={y.year} className="flex justify-between gap-4 py-1"><dt>{y.year}</dt><dd className="tabular-nums">{money(y.amount)}</dd></div>)}
                </dl>
                {account.interest.effectiveRate !== null ? (
                  <p className="text-text-2">{tr("Ultimi 12 mesi: {0}, un tasso effettivo del {1} sul prestito medio di {2}.", { 0: money(account.interest.last12Months), 1: formatPct(account.interest.effectiveRate, 1), 2: money(account.interest.averageBorrowed) })}</p>
                ) : null}
              </div>
            ) : null}
            <MarginEstimate loan={account.loan} securities={account.securities} />
            {account.missingFx ? <p className="text-xs text-muted-foreground">{tr("Manca il cambio di una valuta: quel saldo non è contato.")}</p> : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
