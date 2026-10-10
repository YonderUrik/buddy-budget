/**
 * Template unico delle email transazionali: HTML a tabelle con CSS inline (quello che i client email leggono),
 * stile "frase" della Panoramica, tema scuro via `prefers-color-scheme` e versione testo equivalente.
 * Pura: niente accesso a env o rete, così si testa senza mock.
 */

/** Colori dell'email: le CSS variables dell'app non esistono nei client, quindi sono i valori dei token (`app/globals.css`). */
export const EMAIL_COLORS = {
  light: { page: "#f7f7f8", text: "#18181b", text2: "#71717a", text3: "#71717a", border: "#d4d4d8", primary: "#15738b", brand: "#1f224e" },
  dark: { page: "#111113", text: "#ececef", text2: "#a1a1aa", text3: "#80808a", border: "#2a2a2f", primary: "#219ebc", brand: "#ececef" },
} as const;

const SANS = "'Hanken Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const HEADING = "'Space Grotesk','Hanken Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const EMAIL_ASSETS_PATH = "/brand/email";
const EMAIL_WIDTH_PX = 540;
const LOGO_WIDTH_PX = 18;
const LOGO_HEIGHT_PX = 22;
const EMAIL_FONTS = [
  { family: "Space Grotesk", file: "space-grotesk", weights: [400, 700] },
  { family: "Hanken Grotesk", file: "hanken-grotesk", weights: [400, 700] },
] as const;

export interface EmailContent {
  /** Etichetta piccola sopra la frase: di che cosa parla l'email. */
  title: string;
  /** La frase principale. `**così**` mette in evidenza cifre e date. */
  lead: string;
  /** Anteprima mostrata dai client accanto all'oggetto; se manca si usa la frase. */
  preheader?: string;
  cta?: { label: string; url: string };
  /** Righe etichetta/valore sotto la frase (es. le categorie più pesanti del riepilogo). */
  details?: { label: string; value: string }[];
  footnote?: string;
  /** Piè di pagina: di servizio (default, senza disiscrizione) oppure opzionale con link per disattivarla. */
  footer?: EmailFooter;
}

/** Le email di servizio (accesso, sicurezza, account) non si possono disattivare e lo dichiarano; le altre portano sempre il link per disiscriversi. */
export type EmailFooter =
  | { kind: "service" }
  | { kind: "optional"; reason: string; unsubscribeUrl: string; preferencesUrl: string };

export const SERVICE_FOOTER_TEXT = "Email di servizio, legata al tuo account o a una funzione che hai attivato: non si può disattivare.";

export interface RenderedEmail {
  html: string;
  text: string;
}

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Neutralizza i caratteri HTML: nomi di banche e titoli arrivano da fuori. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/** Trasforma `**x**` in grassetto, dopo aver fatto l'escape del resto. */
function leadToHtml(lead: string): string {
  const { light } = EMAIL_COLORS;
  return escapeHtml(lead).replace(/\*\*(.+?)\*\*/g, `<b class="t" style="color:${light.text};font-weight:700">$1</b>`);
}

function fontFaces(assetsUrl: string): string {
  return EMAIL_FONTS.flatMap(({ family, file, weights }) =>
    weights.map((w) => `@font-face{font-family:'${family}';font-weight:${w};src:url(${assetsUrl}/${file}-latin-${w}-normal.woff2) format('woff2')}`),
  ).join("");
}

function darkStyles(): string {
  const { dark } = EMAIL_COLORS;
  return `@media (prefers-color-scheme:dark){.bg{background:${dark.page}!important}.t{color:${dark.text}!important}.t2{color:${dark.text2}!important}.t3{color:${dark.text3}!important}.ghost{border-color:${dark.border}!important}.brand{color:${dark.brand}!important}}@media (max-width:480px){.lead{font-size:21px!important}}`;
}

/** HTML + testo di un'email. `appUrl` serve per logo e font, che vivono nei file pubblici dell'app. */
export function renderEmail(content: EmailContent, options: { appUrl: string }): RenderedEmail {
  const { light } = EMAIL_COLORS;
  const assetsUrl = `${options.appUrl}${EMAIL_ASSETS_PATH}`;
  const preheader = escapeHtml(content.preheader ?? content.lead.replace(/\*\*/g, ""));
  const cta = content.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td class="ghost" style="border:1px solid ${light.border};border-radius:10px"><a href="${escapeHtml(content.cta.url)}" class="t" style="display:inline-block;padding:11px 20px;font-family:${SANS};font-size:15px;font-weight:700;color:${light.text};text-decoration:none">${escapeHtml(content.cta.label)}</a></td></tr></table>`
    : "";
  const footnote = content.footnote
    ? `<tr><td class="t3" style="padding:20px 4px 0;font-family:${SANS};font-size:12px;line-height:1.6;color:${light.text3}">${escapeHtml(content.footnote)}</td></tr>`
    : "";
  const details = content.details?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px">${content.details
        .map(
          (row) =>
            `<tr><td class="t2 ghost" style="padding:9px 0;border-top:1px solid ${light.border};font-family:${SANS};font-size:15px;color:${light.text2}">${escapeHtml(row.label)}</td><td class="t ghost" align="right" style="padding:9px 0;border-top:1px solid ${light.border};font-family:${HEADING};font-size:15px;font-weight:700;color:${light.text}">${escapeHtml(row.value)}</td></tr>`,
        )
        .join("")}</table>`
    : "";
  const footer = content.footer ?? { kind: "service" };
  const footerHtml =
    footer.kind === "optional"
      ? `Ricevi questa email perché hai attivato ${escapeHtml(footer.reason)}. <a href="${escapeHtml(footer.unsubscribeUrl)}" class="t3" style="color:${light.text3};text-decoration:underline">Disattiva queste email</a> · <a href="${escapeHtml(footer.preferencesUrl)}" class="t3" style="color:${light.text3};text-decoration:underline">Gestisci le preferenze</a>`
      : escapeHtml(SERVICE_FOOTER_TEXT);
  const footerText =
    footer.kind === "optional"
      ? `Ricevi questa email perché hai attivato ${footer.reason}.\nDisattiva queste email: ${footer.unsubscribeUrl}\nGestisci le preferenze: ${footer.preferencesUrl}`
      : SERVICE_FOOTER_TEXT;
  const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${escapeHtml(content.title)}</title><style>${fontFaces(assetsUrl)}${darkStyles()}</style></head>
<body class="bg" style="margin:0;background:${light.page};font-family:${SANS}"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bg" style="background:${light.page}"><tr><td align="center" style="padding:36px 16px"><table role="presentation" width="${EMAIL_WIDTH_PX}" cellpadding="0" cellspacing="0" style="max-width:${EMAIL_WIDTH_PX}px;width:100%">
<tr><td style="padding:0 4px 40px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="padding-right:10px"><img src="${assetsUrl}/logo-mark.png" width="${LOGO_WIDTH_PX}" height="${LOGO_HEIGHT_PX}" alt="" style="display:block;border:0"></td><td class="brand" style="font-family:${HEADING};font-size:15px;font-weight:700;color:${light.brand}">BuddyBudget</td></tr></table></td></tr>
<tr><td style="padding:0 4px"><div class="t3" style="font-family:${SANS};font-size:13px;color:${light.text3};padding-bottom:10px">${escapeHtml(content.title)}</div>
<p class="t2 lead" style="margin:0 0 ${content.cta || details ? 28 : 0}px;font-family:${HEADING};font-size:25px;line-height:1.5;font-weight:400;color:${light.text2}">${leadToHtml(content.lead)}</p>${details}${cta}</td></tr>${footnote}
<tr><td class="t3" style="padding:14px 4px 0;font-family:${SANS};font-size:12px;line-height:1.6;color:${light.text3}">${footerHtml}<br>BuddyBudget</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    content.title,
    content.lead.replace(/\*\*/g, ""),
    content.details?.length ? content.details.map((row) => `${row.label}: ${row.value}`).join("\n") : null,
    content.cta ? `${content.cta.label}: ${content.cta.url}` : null,
    content.footnote,
    footerText,
  ]
    .filter(Boolean)
    .join("\n\n");
  return { html, text };
}
