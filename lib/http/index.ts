/** lib/http — barrel file: request helpers shared by app route handlers. */
export { isBearerOnlyRequest, isTrustedWriteOrigin } from "./same-origin";
export { API_ERROR_CODES, GENERIC_ERROR_CODES, apiError, genericErrorCode, validationError, withErrorCode, type ApiErrorCode } from "./api-error";
