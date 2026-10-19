/**
 * English home (`/en`): the same sections, facts and demo figures as the Italian home (`content/home.ts`), written for
 * people outside Italy. The product framing: open source and self-hostable, one net worth from cash, investments,
 * pension and debts, with the tax rules of the product country (Italy in full, Germany partly). Only facts that are
 * true in the product; when the Italian copy changes a fact, this file changes with it.
 */
import { EN_PATHS } from "../locales";
import { FIELD_ENCRYPTION_LIVE } from "../security";
import { SUPPORTED, type BankCountry } from "../sheet";
import { SOURCE_LICENSE, SOURCE_URL, type FaqItem } from "../site";
import type { HomeContent } from "../home";
import { SECURITY_SOURCES_EN } from "./security";

/** Title and description of the English pages (root layout and home). */
export const SITE_TITLE_EN = "BuddyBudget: open-source personal finance, all in one number";
export const SITE_DESCRIPTION_EN =
  "Bank accounts, investments, pension and debts in one net worth, updated every day, with Italian taxes worked out. Read-only bank connection or file upload. Open source and self-hostable; Cash is free, the rest is Pro.";
export const OG_ALT_EN = "BuddyBudget: all your money, in one number";

/** Countries whose banks can be linked, with English names (same codes as `SUPPORTED.countries`). */
const BANK_NAMES_EN: Record<BankCountry["code"], string> = { it: "Italy", de: "Germany", fr: "France", es: "Spain", gb: "the UK" };
const BANKS_EN: readonly BankCountry[] = SUPPORTED.countries.map((c) => ({ code: c.code, name: BANK_NAMES_EN[c.code] }));
const BANK_LIST_EN = `${BANKS_EN.slice(0, -1).map((c) => c.name).join(", ")} and ${BANKS_EN.at(-1)?.name}`;

/** Frequently asked questions of the English home, also the FAQPage structured data of `/en`. */
export const FAQ_EN: readonly FaqItem[] = [
  { question: "Is it free?", answer: "The Cash section is, with no end date. Pro unlocks everything else for €1.99 a month or €20 a year, with a 14-day free trial; until Pro starts, everything is unlocked. If you install it on your own servers everything is free, and your data comes with you in a ZIP file." },
  {
    question: "Which countries and languages?",
    answer: `Two products: Italy, in Italian and English, and Germany, in German and English. You pick the currency. Italy has every feature. Germany has the essentials: accounts, portfolio, dividends and partial 2026 tax estimates, with the limits written out; pension and the advanced simulators stay hidden until they have been reviewed. Banks can be connected in ${BANK_LIST_EN}.`,
  },
  { question: "Do I have to connect my bank?", answer: "No. You can add accounts by hand or upload a file. The connection only saves you typing transactions, and it can only read." },
  {
    question: "Are the taxes real?",
    needs: "taxes",
    answer: "They are estimates. For Italy: 26% on gains, 12.5% on government bonds, losses carried forward for four years (the zainetto fiscale) and stamp duty (bollo). For Germany, partial 2026 estimates. They are for making decisions; the final figure comes from your bank, your broker or your accountant.",
  },
  { question: "What doesn't it do?", answer: "It doesn't tell you what to buy or sell. It doesn't move money or place orders with your broker. Prices are end-of-day, not real time." },
  {
    question: "Where is my data?",
    answer: `${FIELD_ENCRYPTION_LIVE ? "On a server in Germany, with encrypted connections, and transaction descriptions and notes encrypted in the database too." : "On a server in Germany, with encrypted connections."} We don't sell data and there are no ads. Download everything as a ZIP or delete your account whenever you like.`,
  },
  { question: "Does it work on my phone?", answer: "Yes, in the browser. You can add it to your home screen like an app. It isn't in the app stores." },
  ...(SOURCE_URL
    ? [{ question: "Can I run it on my own server?", answer: "Yes. The code is open source (AGPL-3.0) and there is a Docker Compose file with the app, the database and the scheduled jobs. You sign in with email and password, no mail server needed. The self-hosting guide is in the repository." }]
    : []),
];

export const HOME_EN: HomeContent = {
  locale: "en",
  hero: {
    title: ["All your money,", "in one number."],
    lede: {
      full: "Bank accounts, investments, pension and mortgage, added up. Updated every day, with the taxes worked out.",
      de: "Bank accounts, investments and mortgage, added up. Updated every day, with the taxes worked out.",
      none: "Bank accounts, investments and mortgage, added up. Updated every day.",
    },
    cta: "Get started free",
    demo: "Try the demo",
  },
  sum: {
    title: "Net worth",
    rows: [
      { label: "Bank accounts", detail: "3 accounts", value: 22595 },
      { label: "Investments", detail: "3 holdings", value: 35389 },
      { label: "Pension fund", detail: "1 fund", value: 11082, needs: "pension" },
      { label: "Mortgage and loans", detail: "3 debts", value: -39937, tone: "neg" },
    ],
    prefix: "€",
    cents: ".53",
    hint: "Type your own amounts: the sum redoes itself and nothing leaves this page.",
    reset: "Put the sample data back",
    fieldLabel: "Amount for {place}",
  },
  places: {
    title: { full: "Four places, one number.", de: "Three places, one number." },
    intro: "Each one goes in once. After that, the app keeps it up to date.",
    items: [
      {
        name: "Your bank",
        hook: "It connects and reads. It can't move money.",
        text: "Transactions arrive by themselves, already categorized. You type your password only on your bank's site. Or you upload a file.",
        spec: `Open Banking (PSD2) via GoCardless · banks in ${BANK_LIST_EN} · 90-day consent · refreshed every 12 hours`,
        art: "banks",
      },
      {
        name: "Your broker",
        hook: "Upload the export. The app reads the trades.",
        text: "What you bought, at what price, and what it's worth today. Several brokers in one portfolio.",
        spec: "Interactive Brokers, DEGIRO, Trade Republic, Fineco, Yahoo Finance or any CSV · no access to your brokerage account · end-of-day prices, ECB exchange rates",
        art: "brokers",
      },
      {
        name: "Your pension fund",
        hook: "Two numbers from your statement. Whenever you like.",
        text: "What you've paid in and what it's worth. The app works out the rest, including a comparison with TFR (Italian severance pay).",
        spec: "Italy only for now · snapshots by hand or from CSV and Excel · yearly return and return on contributions · net estimate if you withdraw today",
      },
      {
        name: "Mortgage and loans",
        hook: "Amount, rate and term. Just once.",
        text: "The schedule payment by payment, the next due dates and what changes if you pay more.",
        spec: "Standard amortization, APR (TAEG), monthly extras, partial early repayment, refinancing · from three of principal, payment, number of payments and rate it works out the fourth",
      },
    ],
    banks: BANKS_EN,
    brokers: SUPPORTED.brokers,
    anyCsv: "any CSV",
    banksLabel: "Countries of the banks",
  },
  showcase: {
    title: "What it tells you, every day.",
    tabs: [
      {
        id: "spese",
        tab: "Spending",
        title: "Where the money goes, without typing a thing.",
        text: "Transactions come in from the bank. The app sorts them into four groups and only asks you when it isn't sure.",
        figure: { value: "€2,164", caption: "spent so far in October · 5 transactions to decide, the app sorted the rest" },
        shot: "movimenti",
      },
      {
        id: "investimenti",
        tab: "Investments",
        title: "What you've really earned.",
        text: "Leaving out the money you put in yourself. Compared with the market and with inflation, and with the risk in one word.",
        figure: { value: "+1.4", small: "%", tone: "pos", caption: "over three months, contributions left out · low risk" },
        shot: "performance",
        more: { href: EN_PATHS.featureInvestments, label: "All about investments" },
      },
      {
        id: "mutuo",
        tab: "Mortgage",
        title: "Is it worth paying off the mortgage early?",
        text: "Type how much more you can pay each month. See when you'd finish and how much interest you'd save. Extra money goes first to the debt that costs the most.",
        figure: { value: "3 years 2 months", caption: "sooner, with €200 more a month · €1,708 of interest saved" },
        shot: "debiti",
        more: { href: EN_PATHS.loanAmortization, label: "Try the loan calculator" },
      },
      {
        id: "futuro",
        tab: "Future",
        title: "When you can stop working.",
        text: "It starts from what you really save and spend, not from a guess. Move a slider and the year moves.",
        figure: { value: "2046", caption: "in 19.2 years, at today's pace" },
        shot: "analitiche",
        needs: "pension",
      },
    ],
    tabsLabel: "Screens",
    all: "All screens",
    allHref: EN_PATHS.screens,
  },
  tax: {
    title: "The net, before you sell.",
    text: "With the Italian rules: 26% on gains, 12.5% on government bonds, past losses that lower the bill, stamp duty. The app estimates it before you sell; your broker does the final sum.",
    specimens: [
      { caption: "You receive if you sell the sample ETF today", value: "€19,772", small: ".18" },
      { caption: "You keep, after €146.93 of tax", value: "€19,625", small: ".25" },
    ],
    more: { href: EN_PATHS.zainetto, label: "Try the calculator, no account needed" },
  },
  trust: {
    title: ["What the app", "does with", "your data"],
    lede: "It reads your accounts to show you the numbers. It can't move money or make payments.",
    facts: [
      {
        title: "Your bank password stays with your bank.",
        text: "You type it only on your bank's site. The connection can only read, and you can remove it whenever you like.",
        terms: ["Read-only", "Revocable"],
        source: { label: "PSD2, art. 67", href: SECURITY_SOURCES_EN.psd2.href },
      },
      {
        title: "Your data stays in Germany.",
        text: FIELD_ENCRYPTION_LIVE
          ? "Encrypted connections; transaction descriptions and notes are encrypted in the database too. Backups in the EU, kept for 14 days."
          : "Encrypted connections. Backups in the EU, kept for 14 days.",
        terms: FIELD_ENCRYPTION_LIVE ? ["Servers in Germany", "Backups in the EU", "AES-256"] : ["Servers in Germany", "Backups in the EU"],
      },
      {
        title: "No ads. Your data is not for sale.",
        text: "Usage statistics are anonymous and cookie-free, on our own servers.",
        terms: ["Cookie-free", "Anonymous", "Our own servers"],
      },
      {
        title: "Take everything with you, any time.",
        text: "A ZIP file with all your data, or delete your account: right away, or with 30 days to change your mind.",
        terms: ["ZIP", "JSON and CSV", "30 days"],
      },
      {
        title: "What we can't promise.",
        text: "The server reads your data to do the maths, so whoever runs the service could see it. It's a small project: no certification and no external audits; the open code is how you check.",
        terms: ["No ISO 27001", "Open code"],
      },
    ],
    more: "Everything about security, with sources",
    moreHref: EN_PATHS.security,
  },
  hood: {
    title: "The code is open.",
    text: "The whole app is public, under the AGPL-3.0 license. You can read how it handles your data, report a problem or run it on your own server with Docker.",
    fallback: `The code is licensed under ${SOURCE_LICENSE} and runs on your own server with Docker.`,
    cta: "See the code on GitHub",
    selfHost: "Self-hosting guide",
    selfHostPath: "/blob/main/docs/self-hosting.md",
    command: {
      label: "Run it yourself",
      lines: ["cd buddy-budget", "./scripts/selfhost-init.sh", "docker compose up -d"],
      copy: "Copy",
      copied: "Copied",
    },
    who: "One person builds it, in Turin, Italy. Write to",
    whoTail: "and you'll hear back from them.",
    facts: [
      { label: "License", value: "AGPL-3.0" },
      { label: "Stack", value: "TypeScript · Next.js · Postgres · Redis" },
      { label: "Self-hosting", value: "Docker Compose: app, database, cron", path: "/blob/main/docs/self-hosting.md" },
      { label: "Bank", value: "Open Banking (PSD2) via GoCardless, read-only" },
      ...(FIELD_ENCRYPTION_LIVE ? [{ label: "In the database", value: "Descriptions and notes encrypted (AES-256)" }] : []),
      { label: "Your data", value: "ZIP export in JSON and CSV, deletion from the app" },
      { label: "Sign-in", value: "Email link or Google, no password" },
      { label: "Security", value: "SECURITY.md", path: "/blob/main/SECURITY.md" },
    ],
  },
  faq: { title: "Before you sign up.", items: FAQ_EN },
  close: {
    title: "Your number, from tomorrow morning.",
    note: "Want to look first? The demo is Giulia's account, no sign-up needed.",
    cta: "Get started free",
    demo: "Try the demo",
  },
};
