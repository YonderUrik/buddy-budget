export {
  CLIENT_ERROR_KINDS,
  CLIENT_ERROR_AREAS,
  CLIENT_ERROR_MESSAGE_MAX,
  CLIENT_ERROR_NAME_MAX,
  CLIENT_ERROR_DIGEST_MAX,
  clientErrorArea,
  clientErrorSchema,
} from "./constants";
export type { ClientErrorKind, ClientErrorArea, ClientErrorReport } from "./constants";
export { CLIENT_ERRORS_ENDPOINT, buildClientErrorReport, reportClientError } from "./report";
