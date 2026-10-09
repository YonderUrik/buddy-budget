/**
 * `llms.txt`: riassunto in Markdown per gli assistenti AI (ChatGPT, Claude, Perplexity, Gemini) e i loro crawler,
 * secondo la proposta llmstxt.org. Nessun testo nuovo: tutto è preso dalle stesse fonti della pagina (FAQ, regole
 * italiane, catalogo funzioni), così non può dire cose diverse dal sito. Si rigenera a ogni build.
 */
import { FEATURE_AREAS, featuresByArea } from "./catalog.generated";
import { GROUPS, ITALY } from "./home";
import { LEGAL_DRAFT, LEGAL_PATHS } from "./legal";
import { CONTENT_DRAFT, CONTENT_PATHS } from "./seo-pages";
import { APP_URL, FAQ, SITE_DESCRIPTION, SITE_NAME, SITE_URL, SOURCE_LICENSE, SOURCE_URL } from "./site";

/** Pagine pubbliche descritte nel file, con la riga che dice a cosa servono. */
const PAGES: readonly { path: string; title: string; text: string }[] = [
  { path: CONTENT_PATHS.zainetto, title: "Calcolatore dello zainetto fiscale", text: "Quanta imposta si evita compensando plusvalenze con minusvalenze (regole italiane, 26% e 12,5%)." },
  { path: CONTENT_PATHS.ammortamento, title: "Calcolatore del piano di ammortamento", text: "Rata, interessi ed estinzione anticipata di mutui e prestiti." },
  { path: CONTENT_PATHS.guidaZainetto, title: "Guida allo zainetto fiscale", text: "Come funzionano le minusvalenze a quattro anni, con esempi e fonti ufficiali." },
  { path: CONTENT_PATHS.funzioneInvestimenti, title: "Investimenti con le tasse italiane", text: "Rendimento vero, rischio, zainetto e bollo calcolati dalle operazioni." },
  { path: CONTENT_PATHS.funzioni, title: "Tutte le funzioni", text: "Elenco completo per area, con lo stato di ognuna." },
  { path: CONTENT_PATHS.schermate, title: "Schermate", text: "Screenshot dell'app vera con dati di esempio." },
];

/** Costruisce il testo di `/llms.txt`. */
export function buildLlmsTxt(): string {
  const lines: string[] = [];
  lines.push(`# ${SITE_NAME}`, "", `> ${SITE_DESCRIPTION}`, "");
  lines.push(
    "Fatti essenziali:",
    "",
    "- App web di finanza personale in italiano per chi vive in Italia: conti e spese, investimenti, fondo pensione, debiti e patrimonio netto in un posto solo.",
    "- Calcola le tasse sugli investimenti con le regole italiane (zainetto fiscale a quattro anni, ETF armonizzati, titoli di Stato al 12,5%, imposta di bollo). Sono stime, non consulenza.",
    "- Gratuita durante la beta. Si usa dal browser e si installa come PWA; non è nei negozi di app.",
    "- La banca si collega in sola lettura con l'Open Banking (PSD2); i server sono in Germania; i dati si esportano in un file ZIP.",
    `- Non è una banca, non è un broker e non dà consigli di investimento.${SOURCE_URL ? ` Il codice è pubblico (${SOURCE_LICENSE}): ${SOURCE_URL}` : ""}`,
    `- Sito: ${SITE_URL} · App: ${APP_URL}`,
    "",
  );
  lines.push("## Regole italiane già calcolate", "");
  for (const r of ITALY.rules) lines.push(`- ${r.rule} ${r.app}${r.source ? ` Fonte: ${r.source.href}` : ""}`);
  lines.push("", "## Il metodo dei quattro gruppi", "");
  for (const g of GROUPS.groups) lines.push(`- **${g.name}**: ${g.text}`);
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
  if (!LEGAL_DRAFT) {
    lines.push("## Optional", "");
    lines.push(`- [Privacy](${SITE_URL}${LEGAL_PATHS.privacy})`, `- [Termini](${SITE_URL}${LEGAL_PATHS.termini})`, "");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}
