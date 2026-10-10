/** lib/support — barrel file: tipi e costanti del canale di supporto, schema della segnalazione e link GitHub. L'invio (solo server) sta in `./send`. */
export * from "./constants";
export { githubIssueUrl, newReportReference, reportContextSchema, reportEmailContent, reportInputSchema, sanitizePath } from "./report";
export type { ReportContext, ReportInput } from "./report";
