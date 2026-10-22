import { extractMerchantName } from "./merchant-name";

/** Legacy reasons retained for older evaluation files and API clients; new requests never block on a name/type. */
export type BlockReason = "operazione" | "persona";

export interface PreparedMerchant {
  /** Cleaned counterparty/transaction label sent to the categorization provider. It may name a person. */
  name: string;
  /** Compatibility field: all names and transaction types are eligible. */
  blocked: null;
}

/** Remove bank boilerplate and extract a label, without rejecting people, transfers or other transaction types. */
export function prepareMerchantForModel(rawDescription: string): PreparedMerchant {
  const trimmed = rawDescription.split(/\s+(?:Carta\s+N\b|Data\s+op)/i)[0].trim();
  const text = trimmed || rawDescription.trim();
  const { name } = extractMerchantName({ rawText: text });
  return { name, blocked: null };
}
