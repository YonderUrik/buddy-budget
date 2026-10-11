import { z } from "zod";
import { REPORT_KINDS, REPORT_MESSAGE_MAX_LENGTH, REPORT_MESSAGE_MIN_LENGTH, REPO_URL, type ReportKind } from "./constants";

const MAX_PATH_LENGTH = 120;
const MAX_VERSION_LENGTH = 40;
const MAX_USER_AGENT_LENGTH = 200;

/** Contesto tecnico allegato alla segnalazione: mai dati finanziari, solo dove e con cosa è successo. */
export const reportContextSchema = z.object({
  path: z.string().max(MAX_PATH_LENGTH),
  version: z.string().max(MAX_VERSION_LENGTH),
  viewport: z.string().regex(/^\d{2,5}x\d{2,5}$/),
  theme: z.enum(["chiaro", "scuro"]),
});
export type ReportContext = z.infer<typeof reportContextSchema>;

export const reportInputSchema = z.object({
  kind: z.enum(REPORT_KINDS),
  message: z.string().trim().min(REPORT_MESSAGE_MIN_LENGTH, "Scrivi qualche parola in più.").max(REPORT_MESSAGE_MAX_LENGTH),
  /** Assente se l'utente ha tolto il contesto. */
  context: reportContextSchema.optional(),
});
export type ReportInput = z.infer<typeof reportInputSchema>;

/** Solo il percorso, senza query né hash: gli id nelle URL non servono e potrebbero essere dati dell'utente. */
export function sanitizePath(path: string): string {
  const clean = path.split(/[?#]/)[0] ?? "";
  return clean.startsWith("/") ? clean.slice(0, MAX_PATH_LENGTH) : "/";
}

/** Codice di riferimento breve da dare all'utente e ritrovare nell'email e nei log (es. `SUP-7K2QF9`). */
export function newReportReference(random: () => number = Math.random): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(random() * alphabet.length)];
  return `SUP-${code}`;
}

export function formatContextLines(context: ReportContext | undefined, userAgent: string | null): string[] {
  if (!context) return ["Contesto: non allegato dall'utente"];
  return [
    `Pagina: ${sanitizePath(context.path)}`,
    `Versione app: ${context.version}`,
    `Schermo: ${context.viewport}, tema ${context.theme}`,
    `Browser: ${(userAgent ?? "sconosciuto").slice(0, MAX_USER_AGENT_LENGTH)}`,
  ];
}

/** Oggetto e testo dell'email per chi gestisce il supporto. Pura, per poterla testare. */
export function reportEmailContent(params: {
  reference: string;
  input: ReportInput;
  userEmail: string;
  userAgent: string | null;
}): { subject: string; text: string } {
  const { reference, input, userEmail, userAgent } = params;
  return {
    subject: `[${reference}] ${input.kind}: ${input.message.replace(/\s+/g, " ").slice(0, 60)}`,
    text: [
      `Tipo: ${input.kind}`,
      `Da: ${userEmail} (rispondi a questa email)`,
      ...formatContextLines(input.context, userAgent),
      "",
      input.message,
    ].join("\n"),
  };
}

/**
 * Link per aprire una issue su GitHub già compilata. Il template dipende dal tipo; per i problemi
 * il contesto tecnico (senza dati personali) finisce nel campo «Dove l'hai visto» e si vede prima dell'invio.
 */
export function githubIssueUrl(kind: ReportKind, context?: ReportContext): string {
  if (kind === "idea") return `${REPO_URL}/issues/new?template=funzionalita.yml`;
  const params = new URLSearchParams({ template: "bug.yml" });
  if (context) {
    params.set("ambiente", `BuddyBudget ${context.version}, pagina ${sanitizePath(context.path)}, schermo ${context.viewport}, tema ${context.theme}`);
  }
  return `${REPO_URL}/issues/new?${params.toString()}`;
}
