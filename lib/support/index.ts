/** lib/support — barrel file: tipi e costanti del canale di supporto, schema della segnalazione e link GitHub. L'invio (solo server) sta in `./send`, l'apertura del foglio dal client (con toast) in `./request-report`. */
export * from "./constants";
export { githubIssueUrl, newReportReference, reportContextSchema, reportEmailContent, reportErrorSchema, reportInputSchema, sanitizePath } from "./report";
export type { ReportContext, ReportError, ReportInput } from "./report";
