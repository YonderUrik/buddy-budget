"use client";

/**
 * Bank step of «Nuovo conto»: one list with the banks that connect today (Trade Republic first) and, while GoCardless
 * is closed or out of slots, «Altre banche · In arrivo» as its last row, plus the way out for a bank not listed.
 * With GoCardless open, Trade Republic joins the searchable GoCardless list instead.
 */

import Link from "next/link";
import { ConnectBankFlow, TradeRepublicLogo, BankRow } from "@/components/domain/accounts";
import type { FeaturedBank } from "@/components/domain/accounts";
import type { CapacityBlockReason } from "@/lib/gocardless/capacity";
import { useLocalization } from "@/lib/localization/provider";
import { BANK_UNAVAILABLE_COPY } from "./bank-capacity.data";
import { BankComingSoon } from "./bank-coming-soon";

const LINK_CLASS = "cursor-pointer font-medium text-foreground underline underline-offset-2 hover:text-primary";

export interface BankPickerProps {
  /** Why GoCardless cannot take a new bank now; `null` when it can. */
  blockedReason: CapacityBlockReason | null;
  /** The person already asked to hear when other banks arrive. */
  interested: boolean;
  /** Whether «Avvisami» can be offered (not on self-hosted installs). */
  canRequest: boolean;
  /** Renewing a GoCardless consent: only the GoCardless list. */
  renew?: boolean;
  onChooseTradeRepublic: () => void;
  onChooseManual: () => void;
  /** Leaving for the file import page (the dialog closes). */
  onImport: () => void;
}

export function BankPicker({ blockedReason, interested, canRequest, renew = false, onChooseTradeRepublic, onChooseManual, onImport }: BankPickerProps) {
  const { t: tr } = useLocalization();
  const tradeRepublic: FeaturedBank = {
    id: "trade-republic",
    name: "Trade Republic",
    keywords: ["TR"],
    detail: tr("Conto e investimenti · approvi nell'app"),
    logo: <TradeRepublicLogo />,
    onSelect: onChooseTradeRepublic,
  };
  if (!blockedReason) return <ConnectBankFlow featured={renew ? [] : [tradeRepublic]} onChooseManual={onChooseManual} />;
  const copy = BANK_UNAVAILABLE_COPY[blockedReason];
  const paused = blockedReason === "paused";
  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col gap-2">
        <li><BankRow logo={tradeRepublic.logo} name={tradeRepublic.name} detail={tradeRepublic.detail} onSelect={tradeRepublic.onSelect} /></li>
        <li>
          {paused
            ? <BankComingSoon interested={interested} canRequest={canRequest} />
            : <BankComingSoon interested={false} canRequest={false} badge={copy.badge} detail={copy.description} />}
        </li>
      </ul>
      <p className="text-sm text-muted-foreground">
        {tr("La tua banca non c'è ancora?")}{" "}
        <button type="button" className={LINK_CLASS} onClick={onChooseManual}>{tr("Tieni il conto a mano")}</button>{" "}
        {tr("oppure")}{" "}
        <Link href="/importazioni" className={LINK_CLASS} onClick={onImport}>{tr("importa l'estratto conto")}</Link>.
      </p>
    </div>
  );
}
