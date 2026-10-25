import { ConnectTradeRepublic } from "@/components/domain/trade-republic";

/** The dedicated direct bank connection screen; credentials are submitted only in the client form. */
export default function TradeRepublicConnectionPage() {
  return <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6"><h1 className="font-heading text-2xl font-semibold">Trade Republic</h1><ConnectTradeRepublic /></div>;
}
