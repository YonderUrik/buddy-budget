import { looksLikeTradeRepublic, parseTradeRepublic } from "./trade-republic";
import { looksLikeDegiro, parseDegiroAccount } from "./degiro";
import { parseInteractiveBrokersActivity } from "./interactive-brokers";
import { looksLikeIbkrFlex, parseIbkrFlexReport } from "./ibkr-flex";

/** Parse a recognized broker statement using the authoritative source-specific reader. */
export function parseBrokerStatement(text: string, today: string) {
  if (looksLikeIbkrFlex(text)) return parseIbkrFlexReport(text, today);
  if (looksLikeTradeRepublic(text)) return parseTradeRepublic(text, today);
  return looksLikeDegiro(text) ? parseDegiroAccount(text, today) : parseInteractiveBrokersActivity(text, today);
}
