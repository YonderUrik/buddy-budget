import { looksLikeDegiro, parseDegiroAccount } from "./degiro";
import { parseInteractiveBrokersActivity } from "./interactive-brokers";

/** Parse a recognized broker statement using the authoritative source-specific reader. */
export function parseBrokerStatement(text: string, today: string) {
  return looksLikeDegiro(text) ? parseDegiroAccount(text, today) : parseInteractiveBrokersActivity(text, today);
}
