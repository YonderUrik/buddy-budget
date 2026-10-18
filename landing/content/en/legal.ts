/**
 * English summary of the legal texts (`/en/privacy`): the same facts as the Italian Privacy policy, Terms and Cookie
 * page in `content/legal.ts`, which are the binding versions. When a fact changes there, it changes here too.
 */
import { LEGAL_OWNER, LEGAL_PATHS, type LegalDocument } from "../legal";

export const LEGAL_SUMMARY_EN: LegalDocument = {
  slug: "summary-en",
  title: "Privacy and terms, in short",
  description: "Who runs BuddyBudget, what data it keeps, who else handles it and for how long, and the rules of the service. An English summary of the Italian legal texts.",
  intro:
    "A plain-English summary of the Privacy policy, the Terms of service and the Cookie page. The Italian texts are the ones that apply: if this page and they disagree, they win.",
  sections: [
    {
      id: "who",
      title: "Who runs the service",
      paragraphs: [
        `BuddyBudget is run by ${LEGAL_OWNER.name}, an individual, not a company, free of charge. Address: ${LEGAL_OWNER.address}.`,
        `For anything about your data, write to ${LEGAL_OWNER.email}.`,
      ],
    },
    {
      id: "data",
      title: "What data we keep",
      items: [
        "Your account: name, email, currency and preferences (and your profile photo if you sign in with Google).",
        "The financial data you enter or import: accounts, balances, transactions with description and notes, categories, budgets, investments, debts, pension funds.",
        "Bank data, if you connect a bank through GoCardless: the accounts and transactions you authorize. Never your bank login.",
        "Files you upload to import, messages you send to support, and the date, shortened IP address and device of your sessions.",
        "Technical logs without emails, names, amounts or descriptions, and anonymous usage statistics.",
      ],
    },
    {
      id: "why",
      title: "Why we use it",
      items: [
        "To run the service you signed up for, including the emails it needs (sign-in links, bank expiry warnings, import results).",
        "Summary and alert emails, and the AI features, only if you turn them on. You can turn them off at any time.",
        "Security, fixing errors and keeping backups.",
        "Anonymous statistics to learn which features get used. We don't sell your data and don't use it for ads.",
      ],
    },
    {
      id: "providers",
      title: "Who else handles it",
      items: [
        "Hostinger: the server in Germany where the app and the database run.",
        "Cloudflare: traffic, DNS and the database backups (R2, in the European Union).",
        "GoCardless: reads the bank accounts you connect, under PSD2.",
        "Resend: sends the emails.",
        "OpenRouter and the model provider it picks: only if you turn on the AI features. For category suggestions it receives merchant names, never amounts or dates; for an AI import it receives the file. We ask that it keeps nothing after the answer and doesn't train on it.",
        "Google: only if you sign in with Google.",
        "Logo.dev: a brand's website, or a merchant name seen in several users' transactions, to show logos. Never amounts or who made the transaction.",
        "Cloudflare, Google, Resend and OpenRouter may handle data outside the EU, under the EU-US Data Privacy Framework or the European Commission's standard contractual clauses.",
      ],
    },
    {
      id: "retention",
      title: "How long we keep it",
      items: [
        "Your data: as long as your account exists.",
        "Deactivating the account gives you 30 days to change your mind; deleting it removes everything right away.",
        "After 90 days without signing in the account is deleted. We email you 7 days before, and one sign-in cancels it.",
        "Backups: deleted data is gone from them after 14 days. Logs: 30 days. Sessions: 7 days without use. Sign-in links: 10 minutes.",
        "AI import: the file is deleted once it has been read, and the preview after 7 days at most.",
      ],
    },
    {
      id: "rights",
      title: "Your rights",
      items: [
        "Download everything as a ZIP file (JSON and CSV) from Settings.",
        "Deactivate or delete the account, and all its data, from Settings.",
        `For anything else (correction, restriction, objection), write to ${LEGAL_OWNER.email}. We answer within one month.`,
        "You can complain to the Italian data protection authority (Garante per la protezione dei dati personali, garanteprivacy.it).",
      ],
    },
    {
      id: "cookies",
      title: "Cookies",
      items: [
        "Only technical ones: the session cookie of the app, temporary cookies while you sign in, and the browser's local storage for your preferences.",
        "The app remembers on that device the email of the last account and the last sign-in method (a cookie that lasts 30 days). «Not you?» on the sign-in page clears them.",
        "Statistics use Umami on our own servers, without cookies. Turn them off in the app under Settings → Privacy, or set localStorage \"umami.disabled\" to \"1\" in your browser.",
        "No profiling, advertising or social cookies.",
      ],
    },
    {
      id: "terms",
      title: "The terms of service, in short",
      items: [
        "You must be 18 or older and use it for yourself, not for a business or for other people's data.",
        "It is free for now and in beta: it can change, have errors or stop, with no guaranteed service levels. Paid plans, if they come, will be announced in advance.",
        "It is not financial, tax or pension advice. Prices are end-of-day closes from third parties and can be late or wrong.",
        "Your data stays yours. We keep backups, but download an export now and then.",
        "The code is AGPL-3.0; these terms cover only the service we run.",
        "It is provided as is. We may close an account that breaks the terms, and we will give reasonable notice before shutting the service down so you can export your data.",
        "Italian law applies, together with the consumer protections of the country where you live; as a consumer you can go to the court where you live.",
      ],
    },
    {
      id: "full-texts",
      title: "The full texts (in Italian)",
      links: [
        { text: "Informativa sulla privacy (Privacy policy)", href: LEGAL_PATHS.privacy },
        { text: "Termini di servizio (Terms of service)", href: LEGAL_PATHS.termini },
        { text: "Cookie e strumenti simili (Cookies)", href: LEGAL_PATHS.cookie },
      ],
    },
  ],
};
