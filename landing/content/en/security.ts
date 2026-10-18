/**
 * English texts of the security page (`/en/security`), the same facts as `content/security.ts` (verified on
 * 2026-10-12). When a sentence changes there, it changes here too; the test in `security.test.ts` checks that the
 * encryption claims follow `FIELD_ENCRYPTION_LIVE` in both languages.
 */
import { LEGAL_OWNER } from "../legal";
import { EN_PATHS } from "../locales";
import { FIELD_ENCRYPTION_LIVE, SECURITY_SOURCES, type SecurityContent } from "../security";

/** The same EU laws on EUR-Lex, in English. */
const eurLexEn = (href: string) => href.replace("/legal-content/IT/", "/legal-content/EN/");

export const SECURITY_SOURCES_EN: SecurityContent["sources"] = {
  psd2: { label: "Directive (EU) 2015/2366 (PSD2), art. 67: an account information service accesses data only with your explicit consent and only for the accounts you choose", href: eurLexEn(SECURITY_SOURCES.psd2.href) },
  rts: { label: "Delegated Regulation (EU) 2018/389: strong customer authentication and secure communication with the bank", href: eurLexEn(SECURITY_SOURCES.rts.href) },
  gocardlessTerms: { label: "GoCardless, Bank Account Data terms (EU): GoCardless SAS, authorized by the ACPR, no. 17118; what it keeps and what for (art. 4.1), no other third parties and credentials never seen (art. 4.3)", href: SECURITY_SOURCES.gocardlessTerms.href },
  gocardlessPrivacy: { label: "GoCardless, privacy notice for account holders who share their account data: data collected and contact of the data protection officer", href: SECURITY_SOURCES.gocardlessPrivacy.href },
  gocardlessPrivacyDetails: { label: "GoCardless, privacy notice details: how long it keeps data, sharing with authorities and transfers outside the EU", href: SECURITY_SOURCES.gocardlessPrivacyDetails.href },
  regafi: { label: "REGAFI, register of authorized firms in France (ACPR): search for GoCardless SAS", href: SECURITY_SOURCES.regafi.href },
  ebaRegister: { label: "EBA, European register of payment institutions", href: SECURITY_SOURCES.ebaRegister.href },
  gdpr: { label: "Regulation (EU) 2016/679 (GDPR): rights of access, portability and erasure (arts. 15-20)", href: eurLexEn(SECURITY_SOURCES.gdpr.href) },
  r2Security: { label: "Cloudflare R2, data security: objects are encrypted at rest", href: SECURITY_SOURCES.r2Security.href },
  r2Location: { label: "Cloudflare R2, EU jurisdiction: data stays in the European Union", href: SECURITY_SOURCES.r2Location.href },
  garante: { label: "Garante per la protezione dei dati personali (the Italian data protection authority): how to file a complaint", href: SECURITY_SOURCES.garante.href },
};

export const SECURITY_EN: SecurityContent = {
  locale: "en",
  page: {
    h1: "What happens to your data",
    title: "Security and privacy: how BuddyBudget handles your data",
    description: "How the read-only bank connection (PSD2) works, what we store and what we don't, where the servers are and how you delete everything. With official sources.",
    lead: "The app reads your accounts and can't move money. Here is the path your data takes, what we keep and what we don't, with the sources to check.",
    kicker: "Security and privacy",
    crumb: "Security and privacy",
    ctaTitle: "Try it without connecting anything.",
    ctaText: "Start with a manual account or the sample data, and connect your bank only when you're ready.",
    more: "Other questions.",
    sourcesSummary: "Official sources",
    legalNote: [
      "For the legal details (legal bases, providers, retention periods) read the ",
      { text: "privacy policy", href: EN_PATHS.privacy },
      ". To report a security issue, write to ",
      { text: LEGAL_OWNER.email, href: `mailto:${LEGAL_OWNER.email}` },
      ".",
    ],
  },
  flow: {
    title: "The path, step by step.",
    lede: "Your login details stay with your bank. Only balances and transactions reach BuddyBudget, read-only.",
    links: ["Login and confirmation", "Read-only consent", "Balances and transactions"],
    neverTitle: "Never.",
    nodes: [
      {
        id: "tu",
        label: "You",
        role: "Pick your bank in the app",
        sees: ["You choose which bank to connect and which accounts to share.", "You can disconnect the bank whenever you like, from the app or from your bank."],
        never: ["You never give BuddyBudget your bank username, password or codes."],
      },
      {
        id: "banca",
        label: "Your bank",
        role: "Where you enter your login",
        sees: ["It identifies you with its own login and an extra confirmation (strong customer authentication), as when you open online banking.", "It asks you to authorize reading your accounts for at most 90 days."],
        never: ["Neither GoCardless nor BuddyBudget receives your login details: you type them only on your bank's pages."],
      },
      {
        id: "gocardless",
        label: "GoCardless",
        role: "Authorized provider (PSD2)",
        sees: ["GoCardless SAS is authorized by the French supervisor (ACPR, no. 17118) to provide account information services.", "It receives balances, account details and transactions from the bank and passes them to BuddyBudget, because you asked it to. It keeps a copy under its own terms and legal obligations."],
        never: ["It doesn't see your login details and can't move money: the service only reads."],
      },
      {
        id: "buddybudget",
        label: "BuddyBudget",
        role: "Server in Germany",
        sees: [
          "It asks only for balances, account details and transactions: there is no payment function anywhere in the code.",
          FIELD_ENCRYPTION_LIVE
            ? "It stores balances and transactions to show them to you and work out budgets and net worth; descriptions and notes are encrypted before they are stored."
            : "It stores balances and transactions (date, amount, description) to show them to you and work out budgets and net worth.",
          "The IBAN is used only to let you pick the account and isn't stored.",
        ],
        never: ["It doesn't sell data, show ads or use your data to profile you."],
      },
    ],
  },
  stored: {
    title: "What we keep, and what never reaches us.",
    rows: [
      { what: "Bank login details", kept: "no", keptLabel: "Never", detail: "They stay with your bank: you enter them only on its pages." },
      { what: "Passwords", kept: "no", keptLabel: "Never", detail: "There are none: you sign in with an email link that works for a few minutes, or with Google." },
      { what: "IBAN", kept: "no", keptLabel: "No", detail: "Used only while you choose which account to connect." },
      {
        what: "Balances and transactions",
        kept: "si",
        keptLabel: "Yes",
        detail: FIELD_ENCRYPTION_LIVE
          ? "On a server in Germany, for as long as you keep the account. Descriptions and notes are encrypted (AES-256) before they reach the database; amounts and dates aren't, because the calculations need them. Disconnecting the bank deletes that account's transactions."
          : "On a server in Germany, for as long as you keep the account. Disconnecting the bank deletes that account's transactions.",
      },
      { what: "Technical logs", kept: "parziale", keptLabel: "30 days", detail: "No emails, names, amounts or descriptions: a user appears only as a code that can't be reversed." },
      {
        what: "Backups",
        kept: "parziale",
        keptLabel: "14 days",
        detail: FIELD_ENCRYPTION_LIVE
          ? "On Cloudflare R2 in the European Union, encrypted at rest by the service. Descriptions and notes stay encrypted there too, and the key is not in the backups. After 14 days, deleted data is gone from there as well."
          : "On Cloudflare R2 in the European Union, encrypted at rest by the service. After 14 days, deleted data is gone from there as well.",
      },
      { what: "Usage statistics", kept: "parziale", keptLabel: "Anonymous", detail: "Pages viewed and actions, without amounts or any text of yours. Umami on our own servers, no cookies: details below." },
    ],
  },
  gocardless: {
    question: "What does GoCardless keep, and for how long?",
    lede: "GoCardless isn't just a pipe: it's an authorized institution with its own obligations and its own privacy notice. Here is what its terms say.",
    rows: [
      { label: "What it keeps", text: "The account holder's name, account details and number, balance and transactions for the period you authorize (EU terms, art. 4.1). Not your bank login: it never sees it (art. 4.3)." },
      { label: "What it uses them for", text: "Only to provide the service. The terms also mention preventing fraud on your accounts and internal analysis to improve the service (art. 4.1)." },
      { label: "Who it shares them with", text: "With BuddyBudget, because you asked it to, and with no other third party (art. 4.3). Like any regulated institution, it must hand them over to the authorities when the law requires it." },
      { label: "For how long", text: "As long as the service needs them, and longer when a legal obligation, a dispute or fraud prevention requires it. Periods vary by type of data and GoCardless doesn't publish a number of years." },
      { label: "Where", text: "GoCardless SAS is based in Paris. Some of its suppliers are outside the EU, including in the United States, under contracts that require them to treat data as European law demands." },
      { label: "If you disconnect the bank", text: "We revoke the consent and GoCardless stops reading your accounts. What it has already received follows its own retention periods: to see it or ask for it to be deleted, you can write to GoCardless (GDPR, arts. 15-17)." },
    ],
    note: [
      "A summary of GoCardless's ",
      { text: "EU terms", href: SECURITY_SOURCES.gocardlessTerms.href },
      " and its ",
      { text: "privacy notice", href: SECURITY_SOURCES.gocardlessPrivacy.href },
      ", where you'll find the contacts to exercise your rights.",
    ],
  },
  ai: {
    question: "Where does AI come in, and what does it see?",
    lede: "AI is off until you say yes. Calculations, rules, bank sync and alerts never use it.",
    rows: [
      { label: "When", text: "Only in three places: category suggestions, importing a bank statement in a new format, and importing investments when the normal reader fails." },
      { label: "What it receives", text: "For categories, the cleaned-up merchant name, whether it's income or an expense, your categories and your instructions: never amounts, dates, IBANs, notes or people's names. For an import, the whole file, because it has to work out its layout." },
      { label: "Where it goes", text: "To OpenRouter, which passes the request to a model provider. With every request we ask for a provider that keeps nothing after the answer and doesn't train on it; if none does, the request doesn't go out." },
      { label: "What it decides", text: "It suggests, it doesn't decide. Your rules come first. If you leave the option on, only suggestions it is at least 90% sure of apply by themselves, marked as set by the app and easy to change." },
      { label: "The limit", text: "No retention is a condition we ask OpenRouter for on every request, not a contract we signed with the model providers." },
      { label: "How to turn it off", text: "Withdraw your consent in Settings at any time: from then on no request goes out. If you host BuddyBudget yourself you can leave AI out entirely: the app works the same." },
    ],
    note: ["Details in the ", { text: "privacy policy", href: `${EN_PATHS.privacy}#ai-categories` }, "."],
  },
  analytics: {
    question: "What do the usage statistics count?",
    lede: "We use statistics to learn which features get used and where people get stuck. They are not for getting to know you.",
    rows: [
      { label: "What we count", text: "Pages viewed and actions such as “account created” or “file imported”, with details only as categories or counts (for example, how many accounts you've connected)." },
      { label: "What it never receives", text: "Amounts, transaction descriptions, merchant names, emails, names or account numbers. The list of events is closed in the code: a new event has to be added there on purpose." },
      { label: "Where", text: "Umami, installed on our own servers. It uses no cookies, doesn't follow you to other sites and doesn't pass data to third parties." },
      { label: "How to turn them off", text: "In the app, under Settings → Privacy, on each device." },
    ],
    note: ["All the details are on the ", { text: "cookie page", href: EN_PATHS.cookies }, "."],
  },
  controls: {
    title: "Take it all with you, or delete it.",
    items: [
      { title: "Disconnect the bank", text: "Removing a bank's last account revokes the consent on GoCardless right away. The consent expires after 90 days anyway, and you renew it only if you want to." },
      { title: "Download your data", text: "From Settings you download a ZIP file with everything, in JSON and CSV." },
      { title: "Delete the account", text: "Right away, or with 30 days to change your mind. Deleting the account also closes the bank connections." },
      { title: "A check before sensitive actions", text: "Export, reset and deletion need a sign-in from the last 10 minutes, and to delete you have to type a confirmation." },
    ],
  },
  limits: {
    title: "What we can't promise.",
    items: [
      {
        title: "It isn't end-to-end encrypted",
        text: FIELD_ENCRYPTION_LIVE
          ? "We encrypt transaction descriptions and notes, and the notes on debts and investments, in the database, so a copy of the database or a backup doesn't show them. But the server holds the key, because it has to read them to work out balances, budgets and taxes: whoever runs the service could technically read them."
          : "To work out balances, budgets and taxes the server has to read your transactions. They are protected by encrypted connections and limited access to the server, but whoever runs the service could technically read them.",
      },
      { title: "No certification", text: "BuddyBudget is a small project: it has no certifications such as ISO 27001 and no external audits. We'd rather say so than let you assume otherwise." },
    ],
  },
  sources: SECURITY_SOURCES_EN,
  sourcesChecked: "12 October 2026",
};
