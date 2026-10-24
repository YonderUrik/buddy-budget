/**
 * `llms.txt`: riassunto in Markdown per gli assistenti AI (ChatGPT, Claude, Perplexity, Gemini) e i loro crawler,
 * secondo la proposta llmstxt.org. Nessun testo nuovo: tutto è preso dalle stesse fonti della pagina (FAQ, regole
 * italiane, catalogo funzioni), così non può dire cose diverse dal sito. Si rigenera a ogni build.
 */
import { FEATURE_AREAS, featuresByArea } from "./catalog.generated";
import { FAQ_EN, SITE_DESCRIPTION_EN } from "./en/home";
import { ITALY } from "./home";
import { EN_PATHS } from "./locales";
import { LEGAL_PATHS } from "./legal";
import { CONTENT_DRAFT, CONTENT_PATHS } from "./seo-pages";
import { SUPPORTED, TOUR } from "./sheet";
import { APP_URL, FAQ, SITE_DESCRIPTION, SITE_NAME, SITE_URL, SOURCE_LICENSE, SOURCE_URL } from "./site";

/** Pagine pubbliche descritte nel file, con la riga che dice a cosa servono. */
const PAGES: readonly { path: string; title: string; text: string }[] = [
  { path: CONTENT_PATHS.strumenti, title: "Calcolatori", text: "I tre calcolatori gratuiti, senza account: zainetto fiscale, piano di ammortamento, obiettivo di risparmio." },
  { path: CONTENT_PATHS.zainetto, title: "Calcolatore dello zainetto fiscale", text: "Quanta imposta si evita compensando plusvalenze con minusvalenze (regole italiane, 26% e 12,5%)." },
  { path: CONTENT_PATHS.ammortamento, title: "Calcolatore del piano di ammortamento", text: "Rata, interessi ed estinzione anticipata di mutui e prestiti." },
  { path: CONTENT_PATHS.obiettivo, title: "Calcolatore dell'obiettivo di risparmio", text: "In quanti mesi si arriva a una cifra con un versamento mensile e un rendimento, e quanto serve al mese per arrivarci entro una data." },
  { path: CONTENT_PATHS.guidaZainetto, title: "Guida allo zainetto fiscale", text: "Come funzionano le minusvalenze a quattro anni, con esempi e fonti ufficiali." },
  { path: CONTENT_PATHS.funzioneInvestimenti, title: "Investimenti con le tasse italiane", text: "Rendimento vero, rischio, zainetto e bollo calcolati dalle operazioni." },
  { path: CONTENT_PATHS.funzioni, title: "Tutte le funzioni", text: "Elenco completo per area, con lo stato di ognuna." },
  { path: CONTENT_PATHS.sicurezza, title: "Sicurezza e privacy", text: "Cosa viene salvato e cosa no, il percorso dei dati per chi ha già una banca collegata (PSD2, tramite GoCardless; i collegamenti nuovi arrivano presto), server in Germania, export e cancellazione, limiti dichiarati." },
  { path: CONTENT_PATHS.schermate, title: "Schermate", text: "Screenshot dell'app vera con dati di esempio." },
  { path: CONTENT_PATHS.about, title: "Chi c'è dietro", text: "Chi costruisce BuddyBudget (Daniele Roccaforte, Torino), perché esiste, come è fatto, chi ha contribuito e i contatti." },
  { path: CONTENT_PATHS.changelog, title: "Novità", text: "Ogni versione rilasciata con la data e cosa è cambiato, presa dal CHANGELOG.md del codice." },
];

/** English pages, for assistants answering in English (the Italian pages are listed in `PAGES`, in Italian). */
const PAGES_EN: readonly { path: string; title: string; text: string }[] = [
  { path: EN_PATHS.home, title: "BuddyBudget in English", text: "The product in one page: one net worth from bank accounts, investments, pension and debts, how each gets in, what it tells you, security and the open code." },
  { path: EN_PATHS.features, title: "All the features", text: "The full list by area, with the status of each." },
  { path: EN_PATHS.featureInvestments, title: "Investments with Italian taxes", text: "Real returns, risk, tax-loss carryforward (zainetto fiscale) and stamp duty (bollo) worked out from your trades." },
  { path: EN_PATHS.security, title: "Security and privacy", text: "What is stored and what is not, the data path for people who already have a bank connected (PSD2, via GoCardless; new connections are coming soon), servers in Germany, export and deletion, stated limits." },
  { path: EN_PATHS.screens, title: "Screens", text: "Screenshots of the real app with sample data." },
  { path: EN_PATHS.privacy, title: "Privacy policy", text: "Who runs the service, what data it keeps and why, which providers handle it, for how long, and your rights (a translation; the Italian text is the binding version)." },
  { path: EN_PATHS.terms, title: "Terms of service", text: "What the service is and isn't, who can use it, liability and governing law (English translation)." },
  { path: EN_PATHS.cookies, title: "Cookies", text: "Only technical cookies and cookie-free anonymous statistics, and how to turn the statistics off (English translation)." },
  { path: EN_PATHS.calculators, title: "Calculators", text: "The three free calculators, no account needed: zainetto fiscale, loan amortization, savings goal." },
  { path: EN_PATHS.zainetto, title: "Zainetto fiscale calculator", text: "How much Italian tax you avoid by offsetting capital gains with past capital losses (Italian tax-loss carryforward, 26% and 12.5%)." },
  { path: EN_PATHS.loanAmortization, title: "Loan amortization calculator", text: "Monthly payment, interest and early repayment of mortgages and loans." },
  { path: EN_PATHS.savingsGoal, title: "Savings goal calculator", text: "How many months it takes to reach an amount with a monthly deposit and a return, and how much a month it takes to get there by a date." },
  { path: EN_PATHS.guideZainetto, title: "Guide to the zainetto fiscale", text: "How Italian capital losses can be used for four years, with examples and official sources." },
  { path: EN_PATHS.about, title: "Who's behind it", text: "Who builds BuddyBudget (Daniele Roccaforte, Turin), why it exists, how it's made, who contributed and how to get in touch." },
  { path: EN_PATHS.changelog, title: "Changelog", text: "Every release with its date and what changed, read from the code's CHANGELOG.md." },
];

/** Builds the text of `/llms.txt`. */
export function buildLlmsTxt(): string {
  const lines: string[] = [];
  lines.push(`# ${SITE_NAME}`, "", `> ${SITE_DESCRIPTION}`, "");
  lines.push(
    "Fatti essenziali:",
    "",
    "- App web di finanza personale in italiano per chi vive in Italia: conto, investimenti, fondo pensione e mutuo sommati in un patrimonio netto aggiornato ogni giorno, con spese, budget del mese, rendimenti, tasse e rate nello stesso posto.",
    "- Calcola le tasse sugli investimenti con le regole italiane (zainetto fiscale a quattro anni, ETF armonizzati, titoli di Stato al 12,5%, imposta di bollo). Sono stime, non consulenza.",
    "- Gratuita durante la beta. Si usa dal browser e si installa come PWA; non è nei negozi di app.",
    "- I movimenti della banca entrano dall'estratto conto (CSV o Excel); il collegamento in sola lettura con l'Open Banking (PSD2) arriva presto. I server sono in Germania; i dati si esportano in un file ZIP.",
    `- Non è una banca, non è un broker e non dà consigli di investimento.${SOURCE_URL ? ` Il codice è pubblico (${SOURCE_LICENSE}): ${SOURCE_URL}` : ""}`,
    `- Sito: ${SITE_URL} · App: ${APP_URL}`,
    "",
  );
  lines.push(
    "## In English",
    "",
    SITE_DESCRIPTION_EN,
    "",
    "- Open-source (AGPL-3.0), self-hostable personal finance web app. Two products: Italy (Italian and English, every feature) and Germany (German and English, essentials only: accounts, portfolio, dividends and partial 2026 tax estimates; pension and advanced simulators hidden until review).",
    "- It is not a bank or a broker and gives no investment advice. It never moves money: the bank connection, coming soon, is read-only.",
    "- The calculators and the zainetto fiscale guide are in English too, and they apply Italian tax law. The legal texts are translated into English; the Italian text is the binding version.",
    "",
  );
  if (!CONTENT_DRAFT) {
    for (const p of PAGES_EN) lines.push(`- [${p.title}](${SITE_URL}${p.path}): ${p.text}`);
    lines.push("");
  }
  for (const q of FAQ_EN) lines.push(`### ${q.question}`, "", q.answer, "");
  lines.push("## Regole italiane già calcolate", "");
  for (const r of ITALY.rules) lines.push(`- ${r.rule} ${r.app}${r.source ? ` Fonte: ${r.source.href}` : ""}`);
  lines.push("", "## Fonti supportate", "");
  for (const b of SUPPORTED.brokers) lines.push(`- **${b.name}**: ${b.detail}`);
  lines.push(`- **Collegamento alle banche (Open Banking, sola lettura, in arrivo)**: ${SUPPORTED.countries.map((c) => c.name).join(", ")}`);
  for (const o of SUPPORTED.other) lines.push(`- ${o.label}`);
  for (const d of TOUR.tabs) {
    const after = [d.after.lead, "strong" in d.after ? d.after.strong : "", "tail" in d.after ? d.after.tail : ""].filter(Boolean).join(" ");
    lines.push("", `## ${d.title}`, "", after, "");
    for (const [label, text] of d.specs) lines.push(`- **${label}**: ${text}`);
  }
  lines.push("", "## Funzioni", "");
  for (const area of FEATURE_AREAS) {
    const features = featuresByArea(area).filter((f) => f.status !== "soon");
    if (features.length === 0) continue;
    lines.push(`### ${area}`, "");
    for (const f of features) lines.push(`- **${f.name}**: ${f.description}`);
    lines.push("");
  }
  if (!CONTENT_DRAFT) {
    lines.push("## Pagine", "");
    for (const p of PAGES) lines.push(`- [${p.title}](${SITE_URL}${p.path}): ${p.text}`);
    lines.push("");
  }
  lines.push("## Domande frequenti", "");
  for (const q of FAQ) lines.push(`### ${q.question}`, "", q.answer, "");
  lines.push("## Optional", "");
  lines.push(`- [Privacy](${SITE_URL}${LEGAL_PATHS.privacy})`, `- [Termini](${SITE_URL}${LEGAL_PATHS.termini})`, `- [Cookie](${SITE_URL}${LEGAL_PATHS.cookie})`, "");
  return `${lines.join("\n").trimEnd()}\n`;
}
