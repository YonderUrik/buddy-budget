/**
 * components/domain/personal-import — barrel file
 *
 * Import di CSV/Excel personali (formato ricavato dall'AI): modulo di caricamento, avanzamento, elenco e dettaglio.
 */

export { PersonalImportUpload, countCsvRows, readPersonalImportFile, formatFileSize, PERSONAL_IMPORT_MAX_BYTES, PERSONAL_IMPORT_MAX_ROWS } from "./personal-import-upload";
export type { PersonalImportUploadProps } from "./personal-import-upload";
export { PersonalImportProgress, PersonalImportList, isActiveJob, PERSONAL_IMPORT_ACTIVE } from "./personal-import-status";
export type { PersonalImportProgressProps, PersonalImportListProps } from "./personal-import-status";
export { PersonalImportReceipt, receiptStage } from "./personal-import-receipt";
export { combineJobs, PERSONAL_IMPORT_MAX_FILES } from "./personal-import-batch";
export type { BatchJob, BatchResult } from "./personal-import-batch";
export type { PersonalImportReceiptFile, PersonalImportReceiptProps } from "./personal-import-receipt";
export { PersonalImportIsland, PersonalImportIslandCard } from "./personal-import-island";
export type { PersonalImportIslandCardProps } from "./personal-import-island";
