/**
 * components/domain/attention — barrel file
 *
 * Avviso "Da sistemare" (transazioni nuove o da categorizzare): card della Panoramica. La sottovoce della
 * sidebar sta in `components/layout` e riceve i conteggi da `app/(app)`.
 */

export { AttentionCard } from "./attention-card";
export type { AttentionCardProps, AttentionCardRow } from "./attention-card";
export { AttentionSection } from "./attention-section";
export type { AttentionSectionProps } from "./attention-section";
export { buildAttentionRows, ATTENTION_CARD_MAX_ROWS } from "./attention-card.utils";
export type { AttentionRowData } from "./attention-card.utils";
