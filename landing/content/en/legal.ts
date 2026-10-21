/**
 * English translation of the legal texts (`/en/privacy`, `/en/terms`, `/en/cookies`). The Italian texts in
 * `content/legal.ts` are the binding ones: when a sentence changes there, it changes here too, in the same PR.
 * `legal.test.ts` checks that both languages have the same sections.
 */
import {
  BACKUP_DAYS,
  BANK_CONSENT_DAYS,
  CSV_PREVIEW_DAYS,
  DEACTIVATION_DAYS,
  INACTIVITY_DAYS,
  INACTIVITY_NOTICE_DAYS,
  LEGAL_OWNER,
  LEGAL_VERSION,
  LOG_DAYS,
  MAGIC_LINK_MINUTES,
  NOTIFICATION_LOG_DAYS,
  SESSION_DAYS,
  SUPPORT_MONTHS,
  type LegalDocument,
} from "../legal";

/** Opening line of every English legal page: the Italian text is the binding one. */
const TRANSLATION_NOTE = "This is a translation of the Italian text, which is the binding version.";

export const PRIVACY_EN: LegalDocument = {
  slug: "privacy-en",
  title: "Privacy policy",
  description: "How BuddyBudget handles your personal and financial data, who it shares it with and how to exercise your rights.",
  intro: `This policy explains what data BuddyBudget collects, why, how long it keeps it and what you can do to control it. It is written under articles 13 and 14 of Regulation (EU) 2016/679 (GDPR). ${TRANSLATION_NOTE}`,
  sections: [
    {
      id: "controller",
      title: "Who the data controller is",
      paragraphs: [
        `The controller is ${LEGAL_OWNER.name}, an individual, who runs BuddyBudget free of charge. Address: ${LEGAL_OWNER.address}.`,
        `For any privacy request, write to ${LEGAL_OWNER.email}. No data protection officer (DPO) has been appointed: it is not required at the current scale of processing. There is no certified email (PEC) address.`,
      ],
    },
    {
      id: "data",
      title: "What data we process",
      items: [
        "Account data: name, email address, currency and the preferences you choose. If you sign in with Google, also your profile photo.",
        "Financial data you enter or import: accounts, balances, transactions (with description, notes, counterparty and, when the imported file has it, the category your bank wrote), categories, budgets, investments, debts, pension funds and net worth. Descriptions may reveal habits, purchases or personal circumstances: we never ask you to enter data about health, opinions or other special categories, but they may appear in transaction texts.",
        "Bank data: if you already have an account connected through Open Banking (no new ones can be connected today), we receive through GoCardless the accounts and transactions you authorize. We neither see nor store your bank login details.",
        "Files you upload to import: bank and broker statements (for example CSV files or broker exports). If you choose the AI import, the file is kept encrypted only while it is processed (see the dedicated section).",
        "Category suggestions: if you turn on the assistant, for each merchant we keep the normalized name, the suggested category and whether you confirmed or changed it (never amounts or dates), together with the date of your consent.",
        "Messages to support: if you write from the Help page, we receive the text, the email address of the account and, unless you remove it, technical context (page, app version, screen size and theme, browser type).",
        "Technical sign-in data: date, shortened IP address (the last part is set to zero) and device type of your sessions, visible in Settings, to protect the account.",
        "Acceptance record: the date and version of the Terms and of this policy that you accepted.",
        "Pseudonymized technical logs: app events and errors, linked to you only by a code that contains no email, name, amounts or descriptions.",
        "Anonymous usage statistics: pages viewed and actions taken (for example \"transaction added\"), without amounts or any text of yours.",
      ],
    },
    {
      id: "purposes",
      title: "Why we process it and on what legal basis",
      paragraphs: ["For each purpose we state the legal basis under article 6 of the GDPR."],
      items: [
        "To provide the service (account, accounts, transactions, investments, debts, pension, import, sync of the bank connections already active, data export): performance of the contract, art. 6.1.b.",
        "To send you service emails (sign-in links, bank connection expiry warnings, import results, deactivation confirmations): performance of the contract, art. 6.1.b. These emails can't be turned off because they are needed to use the account.",
        "To send you, only if you turn them on in Settings → Notifications, the periodic summary (with the income, spending and budget figures you already see in the app) and alerts on budgets and upcoming instalments: your consent, art. 6.1.a. They are off until you choose them, every email has a link to turn it off in one click (without signing in) and you can change your mind at any time. We send no promotional emails and no personalized advice.",
        "To analyse an unrecognized import file with artificial intelligence: your explicit consent, art. 6.1.a, which you give before uploading the file and can withhold by using the other import types or manual entry. Consent is not a condition for using the rest of the service.",
        "To suggest a category for new transactions with an artificial intelligence service (and, if you choose, to apply the most certain suggestions by themselves): your explicit consent, art. 6.1.a, which you give in Settings (or during onboarding) and can withdraw at any time. Consent is not a condition for using the rest of the service: you can categorize by hand or with rules.",
        "To answer messages sent from the Help page: performance of the contract, art. 6.1.b, for requests about your account; legitimate interest, art. 6.1.f, for general ideas and reports.",
        "Security, abuse prevention, error diagnosis and service continuity (sessions, logs, backups): legitimate interest, art. 6.1.f, balanced by logs being pseudonymized and short-lived.",
        "Learning which features are used to improve the product, with anonymous statistics: legitimate interest, art. 6.1.f. You can turn them off at any time (see the cookie page).",
        "Keeping proof of your acceptance of the Terms and of this policy: legitimate interest, art. 6.1.f, in being able to show it.",
        "Complying with legal obligations, if and when they apply: art. 6.1.c.",
      ],
    },
    {
      id: "open-banking",
      title: "Bank connection (Open Banking)",
      paragraphs: [
        `No new banks can be connected today: people who already have a connection keep it and renew it as before. The connection goes through GoCardless Bank Account Data, an account information service provider authorized under the PSD2 directive. You authorize access directly with your bank; the authorization lasts at most ${BANK_CONSENT_DAYS} days, after which it must be renewed, and you can revoke it at any time.`,
        "The consent you give your bank and GoCardless is separate from this policy. If you delete the account or reset your data, we revoke the active connections at GoCardless. We may also remove expired or unused connections from GoCardless.",
        "If you press «Tienimi aggiornato» (Keep me posted) we save the request with your account and the country you chose, and we send you a single email when the connection is available again: this is based on your consent, art. 6.1.a. You withdraw it with «Non avvisarmi più» (Stop notifying me) in the same place in the app; the request is also deleted with the account.",
      ],
    },
    {
      id: "ai-import",
      title: "Import with artificial intelligence",
      paragraphs: [
        "If you upload a CSV in a format BuddyBudget doesn't know, you can ask for it to be analysed by an artificial intelligence model that writes the rules for reading the file. You are asked for explicit consent before it is sent.",
        "The model receives the full text of the file and the name of the source you entered, even if it contains personal data about you or others (for example counterparty names in descriptions). The service used is OpenRouter, which routes the request to a model provider. We require that the provider keeps no data after the answer (zero data retention) and doesn't use it to train models; if no provider meets these conditions, the analysis doesn't start.",
        `The file is stored encrypted on our servers and deleted when processing ends. The preview of the result stays encrypted for ${CSV_PREVIEW_DAYS} days, or until you save it. The reading rules generated for your format remain until you delete the account or reset your data. The rules run on our servers, in an isolated environment, without network access.`,
        "The rules are generated and checked automatically, not by a person: always check that the imported transactions match your statement. You can delete an import at any time from Investimenti (Investments) → Operazioni (Transactions) → Gestisci importazioni (Manage imports).",
      ],
    },
    {
      id: "ai-categories",
      title: "Category suggestions with artificial intelligence",
      paragraphs: [
        "If you turn it on in Settings → Category assistant (it is off until you choose it), for new transactions from syncs and imports we send an artificial intelligence model the cleaned-up merchant name, the direction (income or expense) and the list of your categories, with a few examples of your past choices and the personal instructions you choose to enter in Settings. Avoid putting personal or bank data in the instructions. We don't send amounts, dates, IBANs, notes, full transaction descriptions, transfers or names that look like a person's.",
        "The service is OpenRouter, in the zero data retention mode described in the next section. The model suggests a category with a degree of confidence. If in Settings you leave on the option «Lascia che l'app scelga quando è abbastanza sicura» (Let the app choose when it is fairly sure), suggestions at least 70% certain apply without asking you: you find them in Categorizza (Categorize) → «Messe dall'app» (Set by the app), marked as coming from artificial intelligence, and you can change them at any time. The other suggestions wait for your confirmation, and a choice becomes a rule only if you ask for it. You can turn off automatic application or withdraw consent at any time: from then on no new requests go out and suggestions already received no longer apply by themselves.",
      ],
    },
    {
      id: "zero-data-retention",
      title: "Zero data retention for artificial intelligence",
      paragraphs: [
        "Every artificial intelligence request (importing a file, category suggestions, «Chiedi all'AI» (Ask the AI) on a transaction) goes through OpenRouter in zero data retention mode: OpenRouter sends it only to model providers that keep no data after the answer and don't use it to train models. If no provider meets these conditions, the request is rejected and doesn't go out.",
        "The condition is enforced twice: it is written into every request our servers send and it is turned on in our OpenRouter account settings for all models, so it holds even if one of the two were missing. OpenRouter doesn't keep the text of requests and answers; it keeps technical usage data (model, amount of text processed, cost).",
        `What it doesn't cover: the mode concerns the providers OpenRouter passes the request to, not what we keep. On our side, as described in the sections above, we keep the result (the file's reading rules, the suggested category) and technical logs without the content of the requests, for ${LOG_DAYS} days. We don't use additional OpenRouter tools such as web search.`,
        "This applies to the service at buddybudget.io. Whoever installs BuddyBudget on their own servers uses their own OpenRouter key: requests still ask for zero data retention, but the account settings are those of whoever installs it.",
      ],
    },
    {
      id: "recipients",
      title: "Who we share data with",
      paragraphs: [
        "We don't sell your data and don't use it for advertising. We share it only with the providers needed to run the service, appointed as processors or, where they act as independent controllers, identified as such. The price, exchange rate and instrument logo services are queried by our servers with only symbols, ISIN codes or security names, never with data that identifies you. For merchant logos, the logo service (Logo.dev) receives from our servers only a brand's website (written in the transactions or known to us) or, for names that appear in several users' transactions, the merchant name: never transfers, amounts or who made the transaction. We may disclose data to authorities when the law requires it. The providers are:",
      ],
      items: [
        "Hostinger: server (VPS) in Germany, where the app and the database run.",
        "Cloudflare: traffic routing, DNS and storage (R2) of the database backups.",
        "GoCardless: reading the bank accounts already connected (no new ones can be connected today), under PSD2.",
        "Resend: sending service emails and, if you turn them on, summaries and alerts (it uses your email address and the text of the emails, which may contain figures from your budget), and delivering the messages you write to support.",
        "OpenRouter and the model provider it selects, always in zero data retention mode: only if you use the AI import or category suggestions, with your consent (see the dedicated sections).",
        "Google: only if you choose to sign in with Google; it acts as an independent controller for authentication.",
        "Monitoring, technical alerting and anonymous statistics tools (Umami), which we run on our own servers and which receive no financial data or content of yours.",
      ],
    },
    {
      id: "transfers",
      title: "Transfers outside the European Economic Area",
      paragraphs: [
        "Cloudflare, Google, Resend and OpenRouter (with the model provider) are companies that may also process data outside the EEA (for example in the United States). In these cases the transfer relies on an adequacy decision (EU-US Data Privacy Framework) or on the European Commission's standard contractual clauses.",
      ],
    },
    {
      id: "retention",
      title: "How long we keep data",
      items: [
        "Account data and financial data: as long as the account exists.",
        `Deactivation: if you deactivate the account you have ${DEACTIVATION_DAYS} days to change your mind, then the data is permanently deleted. You can also delete everything right away from Settings.`,
        `Inactivity: if you don't sign in for ${INACTIVITY_DAYS} days the account is deleted with all its data. We write to the account's address ${INACTIVITY_NOTICE_DAYS} days before: one sign-in, even just one, cancels the deletion.`,
        `Backups: deleted data stays in backups for at most ${BACKUP_DAYS} days, then disappears with rotation.`,
        `Sessions: they expire after ${SESSION_DAYS} days without use and expired sessions are deleted. Sign-in links are valid for ${MAGIC_LINK_MINUTES} minutes.`,
        `AI import: the file is deleted when processing ends, the preview after at most ${CSV_PREVIEW_DAYS} days, the reading rules when the account is deleted.`,
        "Category suggestions: as long as the account exists or until you reset your data; withdrawing consent stops new requests.",
        `Technical logs: ${LOG_DAYS} days.`,
        `Messages to support: in the controller's mailbox, for the time needed to answer and in any case no longer than ${SUPPORT_MONTHS} months after the request is closed. Deleting the account doesn't delete them automatically: you can ask for them to be deleted by writing to ${LEGAL_OWNER.email}.`,
        `Summary and alert emails: the preferences as long as the account exists; the log of sent emails (only technical keys to avoid repeating the same alert, without amounts) ${NOTIFICATION_LOG_DAYS} days.`,
        "Record of acceptance of the Terms: as long as the account exists.",
        "Anonymous usage statistics: they are not personal data, so they have no expiry tied to your account.",
      ],
    },
    {
      id: "rights",
      title: "Your rights",
      paragraphs: [
        "You have the right to access your data, correct it, erase it, restrict its processing, receive it in a portable format and object to processing based on legitimate interest (arts. 15-22 GDPR). Where processing is based on consent (the AI import and category suggestions) you can withdraw it at any time, without affecting processing already carried out.",
      ],
      items: [
        "Access and portability: in Settings you download a ZIP archive with all your data in JSON and CSV.",
        "Erasure: in Settings you can deactivate or delete the account and erase all data.",
        `Correction, restriction, objection and any other request: write to ${LEGAL_OWNER.email} (in Settings → Privacy you'll find ready-made messages). We answer within one month, extendable by two in complex cases, as provided by art. 12 GDPR.`,
        "Complaint: you can contact the Italian data protection authority (Garante per la protezione dei dati personali, garanteprivacy.it).",
      ],
    },
    {
      id: "obligation",
      title: "If you don't provide data",
      paragraphs: [
        "Account data (email) is needed to create the account and sign you in; without it we can't provide the service. You enter all other data yourself: if you don't, the features that need it can't be used.",
      ],
    },
    {
      id: "automated-decisions",
      title: "Automated decisions",
      paragraphs: [
        "BuddyBudget makes no decisions that produce legal effects on you. Transaction categorization uses rules you can see and change, your past choices, the category your bank wrote in the files you import and, if you turn it on, suggestions from an artificial intelligence model. The bank's category, when it clearly matches one of yours, applies by itself (without artificial intelligence); if you choose, the most certain suggestions apply by themselves too: they only concern the label of your transactions, are always marked as applied automatically and you can correct them at any time. Tax estimates, projections and simulations are informational tools, not decisions about you.",
      ],
    },
    {
      id: "security",
      title: "How we protect data",
      paragraphs: [
        "Encrypted connections, limited and protected administrative access, a fresh sign-in check before sensitive actions (export, reset, deletion), logs without personal data in clear text, encrypted import files and backups on a service that encrypts them at rest. If an incident exposed your data in a way that puts you at risk, we would notify the Garante and you within the time limits of articles 33 and 34 of the GDPR.",
      ],
    },
    {
      id: "minors",
      title: "Minors",
      paragraphs: ["The service is for people aged 18 or over. If we find that an account belongs to a minor, we delete it."],
    },
    {
      id: "changes",
      title: "Changes to this policy",
      paragraphs: [
        `The version in force is the one of ${LEGAL_VERSION}. If it changes substantially, we tell you in the app before the change applies.`,
      ],
    },
  ],
};

export const TERMS_EN: LegalDocument = {
  slug: "terms-en",
  title: "Terms of service",
  description: "The rules for using BuddyBudget: what the service is and isn't, what we ask of you and our responsibilities.",
  intro: `These terms govern the use of BuddyBudget. By creating an account you declare that you have read and accept them. ${TRANSLATION_NOTE}`,
  sections: [
    {
      id: "service",
      title: "What BuddyBudget is",
      paragraphs: [
        `BuddyBudget is a personal finance application offered by ${LEGAL_OWNER.name}, an individual (${LEGAL_OWNER.address}): it collects and organizes accounts, spending, investments, debts and pension to give you a picture of your net worth.`,
        "For now it is free and in beta: it may change, have errors or be interrupted, and there are no guaranteed service levels. If we introduce paid plans in the future, we will announce them in advance.",
      ],
    },
    {
      id: "requirements",
      title: "Who can use it",
      paragraphs: [
        "You must be at least 18 years old and use the service for personal purposes, not for professional activity or to manage other people's data. You are responsible for keeping your access private and for the data you enter.",
      ],
    },
    {
      id: "no-advice",
      title: "It is not financial, tax or pension advice",
      paragraphs: [
        "Calculations, estimates, simulations, charts, tax estimates, pension projections and comments on securities are for information only and are based on the data you enter and on simplified assumptions. They are not an investment recommendation or personalized advice, and BuddyBudget is not a financial intermediary. Tax and pension rules change and depend on your situation: before deciding, consult a qualified professional.",
        "Market prices come from third-party sources, may be delayed or wrong and are end-of-day closes, not real-time quotes. The same goes for data received from banks through the Open Banking connections already active: it depends on the bank and on the connection provider.",
        "The AI import produces automatically generated reading rules: check that the imported transactions match your documents. Categories set by the app (from your rules, from your bank's category in imported files or from the most certain suggestions, if you chose so) may be wrong: they are marked as set by the app, you can change them at any time and you are the one who checks that they are right.",
        "Artificial intelligence requests go through OpenRouter only to providers that keep no data and don't use it for training (zero data retention, see the privacy policy); if none is available the feature doesn't answer and your data stays as it is.",
      ],
    },
    {
      id: "use",
      title: "How we ask you to use it",
      items: [
        "Enter only data you have the right to use and connect only bank accounts you hold.",
        "Don't try to access other users' data, bypass technical limits or overload the service.",
        "Don't extract data from the service automatically with tools we don't provide, and don't use the service for unlawful activities.",
        "Don't upload files containing viruses or content that breaks the law or other people's rights.",
      ],
    },
    {
      id: "your-data",
      title: "Your data",
      paragraphs: [
        "The data you enter stays yours. You authorize us to process it only to provide the service, as explained in the privacy policy. You can export or delete it at any time from Settings. We make backups, but we recommend downloading an export now and then: we don't guarantee that every piece of data can always be recovered.",
      ],
    },
    {
      id: "source-code",
      title: "Source code and license",
      paragraphs: [
        "BuddyBudget's code is published under the GNU AGPL-3.0 license and you can use it under that license. These terms only govern the use of the service we run, not the license of the code.",
      ],
    },
    {
      id: "liability",
      title: "Liability",
      paragraphs: [
        "The service is provided \"as is\", without guarantees of continuity or freedom from errors. To the extent permitted by law, we are not liable for financial decisions made on the basis of the information shown, for errors or delays in third-party data (banks, price providers, tax sources) or for indirect damages. Nothing in these terms excludes liability that the law doesn't allow to be excluded, nor the rights the law grants to consumers.",
      ],
    },
    {
      id: "suspension",
      title: "Suspension and closure",
      paragraphs: [
        `You can close the account whenever you want, from Settings. If you don't sign in for ${INACTIVITY_DAYS} days we close the account and delete the data: we warn you by email ${INACTIVITY_NOTICE_DAYS} days before, and a sign-in before that date cancels the deletion. We may suspend or close an account that breaks these terms or puts the service at risk, telling you when possible. We may also discontinue the service, with reasonable notice and time for you to export your data.`,
      ],
    },
    {
      id: "changes",
      title: "Changes to the terms",
      paragraphs: [
        `The version in force is the one of ${LEGAL_VERSION}. If they change substantially, we tell you in the app and ask you to accept again; if you don't accept, you can export your data and close the account.`,
      ],
    },
    {
      id: "law",
      title: "Governing law, jurisdiction and contacts",
      paragraphs: [
        `Italian law applies, without prejudice to the mandatory consumer protection rules of your country of residence. If you act as a consumer, disputes go to the court of the place where you live or are domiciled; in all other cases the court of Turin has jurisdiction. For questions write to ${LEGAL_OWNER.email}.`,
      ],
    },
  ],
};

export const COOKIES_EN: LegalDocument = {
  slug: "cookies-en",
  title: "Cookies and similar tools",
  description: "Which cookies and browser storage the BuddyBudget site and app use, and how to turn off statistics.",
  intro: `The site and the app use only technical tools needed to work and anonymous, cookie-free statistics, aggregated and run by us. That is why we show no consent banner. This page fulfils the information obligation (art. 122 of the Italian Privacy Code and the Garante's cookie guidelines of 10 June 2021). ${TRANSLATION_NOTE}`,
  sections: [
    {
      id: "technical",
      title: "Technical tools (no consent needed)",
      items: [
        `App session cookie (app.buddybudget.io): keeps you signed in, expires after ${SESSION_DAYS} days without use and is removed when you sign out.`,
        "Temporary security cookies during sign-in (for example when you choose Google), needed to complete it.",
        "Browser local storage: remembers light or dark theme, sidebar state, collapsed sections, the choice to hide amounts, the statistics choice and screen preferences.",
        "Language and country: an app cookie remembers the language you chose (one year); on the website a one-day cookie holds only the country you connect from, which Cloudflare derives from your IP address, to propose the right language and not show features that are not available in your country yet. The IP address is not stored; the website keeps the language you pick in local storage.",
        "To let you back in faster, the app remembers on that device the email of the last account that signed in (in local storage) and the method used for the last sign-in (a cookie that lasts 30 days). They stay only in your browser: \"Non sei tu?\" (Not you?) on the sign-in page clears them.",
        "These tools deliver what you ask for: for technical cookies the Garante (Guidelines, par. 5) requires only information, not consent.",
      ],
    },
    {
      id: "statistics",
      title: "Anonymous usage statistics",
      paragraphs: [
        "We use Umami, installed on our own servers, to count visits and actions (for example \"transaction added\"). It uses no cookies, doesn't follow you to other sites, applies to one site at a time and receives no amounts, names or texts of yours. It is not shared with third parties. It serves only aggregate statistics: that is why we treat it like the statistical tools that the Guidelines (par. 7.2) equate to technical ones, without consent.",
        "Don't want your visits counted? In the app, under Settings → Privacy, turn off \"Statistiche d'uso anonime\" (Anonymous usage statistics). On the site, and in general, set the localStorage value \"umami.disabled\" to \"1\" in your browser (localStorage.setItem(\"umami.disabled\", \"1\")). The choice applies to the device and site where you make it.",
      ],
    },
    {
      id: "third-party",
      title: "Third-party cookies",
      paragraphs: [
        "We use no profiling, advertising or social cookies. Fonts are served from our own domain. If you sign in with Google, Google may set its own cookies on its sign-in page, which has its own policy.",
      ],
    },
    {
      id: "changes",
      title: "Changes",
      paragraphs: [`Version of ${LEGAL_VERSION}. If we add non-technical tools, we will ask for your consent first.`],
    },
  ],
};

export const LEGAL_DOCUMENTS_EN = [PRIVACY_EN, TERMS_EN, COOKIES_EN] as const;
