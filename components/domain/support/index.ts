/** components/domain/support — barrel file: pagina «Aiuto e segnalazioni» e sue parti riusabili. */
export { SupportPage } from "./support-page";
export type { SupportPageProps } from "./support-page";
export { ReportForm } from "./report-form";
export type { ReportFormProps } from "./report-form";
export { FaqList } from "./faq-list";
export type { FaqListProps } from "./faq-list";
export { FAQ_ITEMS } from "./faq.data";
export type { FaqItem } from "./faq.data";
export { GithubLinks } from "./github-links";
export type { GithubLinksProps } from "./github-links";
export { DonationLink } from "./donation-link";
export type { DonationLinkProps } from "./donation-link";
export { ErrorWithReport, QuickReportProvider, ReportErrorLink, useQuickReport } from "./quick-report";
export type { ReportErrorLinkProps } from "./quick-report";
export type { OpenReportOptions } from "@/lib/support/request-report";
