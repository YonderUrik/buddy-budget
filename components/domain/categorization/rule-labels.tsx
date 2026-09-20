/** Etichette in italiano condivise tra `RuleRow` e `AddRuleForm` per tipo di match e origine regola. */

export const RULE_MATCH_TYPE_LABELS: Record<"merchant" | "contains", string> = {
  merchant: "Esatta",
  contains: "Contiene",
};

export const RULE_SOURCE_LABELS: Record<"appresa" | "manuale", string> = {
  appresa: "Appresa",
  manuale: "Manuale",
};
