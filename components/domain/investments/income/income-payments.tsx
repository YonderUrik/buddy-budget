"use client";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";
import type { Instrument } from "@/lib/db/schema/investments";
import type { IncomePayment } from "@/lib/investments/income";

import { parseDateOnly } from "@/lib/calc/expenses";


export interface IncomePaymentsProps {
  payments: IncomePayment[];
  currency: string;
  instrumentsById?: Map<string, Instrument>;
}

/** Recorded payments with dates and gross-to-net detail; shared by instrument and year disclosures. */
export function IncomePayments({ payments, currency, instrumentsById }: IncomePaymentsProps) {
  const { locale: formattingLocale } = useLocalization();
  const { formatCurrency } = localizedFormats(formattingLocale);
  const DATE_FORMAT = new Intl.DateTimeFormat(formattingLocale, { day: "2-digit", month: "short", year: "numeric" });

  const { t: tr } = useLocalization();
  if (!payments.length) return <p className="py-3 text-sm text-muted-foreground">{tr("Nessun pagamento registrato.")}</p>;
  const money = (amount: number) => formatCurrency(amount, currency);
  return <ul className="divide-y divide-border" aria-label={tr("Pagamenti registrati")}>
    {payments.map((payment) => <li key={payment.id} className="space-y-2 py-3 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span><time dateTime={payment.date}>{DATE_FORMAT.format(parseDateOnly(payment.date))}</time> {"·"}{payment.kind === "cedola" ? tr("Cedola") : tr("Dividendo")}</span>
        {instrumentsById ? <span className="font-medium">{instrumentsById.get(payment.instrumentId)?.name ?? tr("Strumento")}</span> : null}
      </div>
      <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        {[[tr("Lordo"), payment.gross], [tr("Imposte"), payment.taxes], [tr("Costi"), payment.fees], [tr("Netto"), payment.net]].map(([label, amount]) => <div key={label}><dt className="text-muted-foreground">{tr(label)}</dt><dd className="tabular-nums">{money(Number(amount))}</dd></div>)}
      </dl>
    </li>)}
  </ul>;
}
