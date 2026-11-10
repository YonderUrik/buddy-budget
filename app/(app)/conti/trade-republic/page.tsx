import { TradeRepublicLogo } from "@/components/domain/accounts";
import { PAGE_TITLE } from "@/components/domain/shared";
import { ConnectTradeRepublic } from "@/components/domain/trade-republic";

/** The dedicated direct bank connection screen (reconnecting from an account); credentials stay in the client form. */
export default function TradeRepublicConnectionPage() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex items-center gap-3">
        <TradeRepublicLogo />
        <h1 className={PAGE_TITLE}>Trade Republic</h1>
      </div>
      <ConnectTradeRepublic />
    </div>
  );
}
