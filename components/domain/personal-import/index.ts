/**
 * components/domain/personal-import — barrel file
 *
 * Import di CSV/Excel personali (formato ricavato dall'AI): modulo di caricamento, avanzamento, elenco e dettaglio.
 */

export { PersonalImportUpload, countCsvRows, readPersonalImportFile, formatFileSize, PERSONAL_IMPORT_MAX_BYTES, PERSONAL_IMPORT_MAX_ROWS } from "./personal-import-upload";
export type { PersonalImportUploadProps } from "./personal-import-upload";
export { PersonalImportProgress, PersonalImportList, isActiveJob, PERSONAL_IMPORT_ACTIVE } from "./personal-import-status";
export type { PersonalImportProgressProps, PersonalImportListProps } from "./personal-import-status";
export { PersonalImportReview } from "./personal-import-review";
export type { PersonalImportReviewProps } from "./personal-import-review";
export { PersonalImportRows } from "./personal-import-rows";
export type { PersonalImportRowsProps } from "./personal-import-rows";
export { PersonalImportReceipt, receiptStage } from "./personal-import-receipt";
export type { PersonalImportReceiptFile, PersonalImportReceiptProps } from "./personal-import-receipt";
export { PersonalImportIsland, PersonalImportIslandCard } from "./personal-import-island";
export type { PersonalImportIslandCardProps } from "./personal-import-island";

export { PersonalImportCorrection } from "./personal-import-correction";
