import { PAGE_TITLE } from "@/components/domain/shared";
import { IbkrFlexPanel } from "@/components/domain/ibkr-flex";
import { LocalizedText } from "@/lib/localization/provider";

/** Interactive Brokers connection through the Flex Web Service (token + Query ID, read-only). */
export default function InteractiveBrokersConnectionPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-2">
        <h1 className={PAGE_TITLE}>Interactive Brokers</h1>
        <p className="text-sm text-text-2"><LocalizedText>Operazioni, dividendi, interessi, commissioni, liquidità e posizioni arrivano da soli ogni giorno, dai rendiconti Flex di Interactive Brokers.</LocalizedText></p>
      </div>
      <IbkrFlexPanel />
    </div>
  );
}
