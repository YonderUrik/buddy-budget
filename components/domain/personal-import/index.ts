/**
 * components/domain/personal-import — barrel file
 *
 * Import di CSV/Excel personali (formato ricavato dall'AI): modulo di caricamento, avanzamento, elenco e dettaglio.
 */

export { PersonalImportUpload, readPersonalImportFile, formatFileSize, PERSONAL_IMPORT_MAX_BYTES, PERSONAL_IMPORT_MAX_ROWS } from "./personal-import-upload";
export type { PersonalImportUploadProps } from "./personal-import-upload";
export { PersonalImportProgress, PersonalImportList, isActiveJob, PERSONAL_IMPORT_ACTIVE } from "./personal-import-status";
export type { PersonalImportProgressProps, PersonalImportListProps } from "./personal-import-status";
export { PersonalImportPreview } from "./personal-import-preview";
