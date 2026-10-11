/**
 * Scrive in una cartella l'HTML delle tre email di riepilogo e avviso con dati d'esempio, per guardarle nel browser
 * (anche in tema scuro) senza inviare nulla: `pnpm tsx scripts/preview-notification-emails.ts <cartella>`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { budgetAlertEmail, deadlineAlertEmail, digestEmail, type EmailContext } from "../lib/notifications/emails";
import { digestPeriod, type DigestData } from "../lib/notifications/digest";

const outDir = path.resolve(process.argv[2] ?? "email-preview");
const appUrl = process.env.APP_URL ?? "http://localhost:3000";
const ctx: EmailContext = {
  appUrl,
  money: (value) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value),
  unsubscribeUrl: `${appUrl}/disiscrizione?t=esempio`,
  preferencesUrl: `${appUrl}/impostazioni#impostazioni-notifiche`,
};

const digest: DigestData = {
  period: digestPeriod("mensile", new Date("2026-10-02T07:00:00Z")),
  spent: 1842.35,
  income: 2350,
  previousSpent: 1620.8,
  topCategories: [
    { name: "Affitto & Mutuo", amount: 720 },
    { name: "Spesa alimentare", amount: 318.4 },
    { name: "Ristoranti & Bar", amount: 164.9 },
  ],
  budget: { total: 5, over: 1 },
  movements: 63,
};

const emails = {
  riepilogo: digestEmail(digest, ctx),
  "avviso-budget": budgetAlertEmail(
    [
      { categoryId: "a", name: "Ristoranti & Bar", threshold: 100, spent: 164.9, budget: 150, itemKey: "a", itemKeys: ["a"] },
      { categoryId: "b", name: "Spesa alimentare", threshold: 80, spent: 318.4, budget: 380, itemKey: "b", itemKeys: ["b"] },
    ],
    ctx,
  ),
  "avviso-rata": deadlineAlertEmail([{ debtId: "d", name: "Mutuo casa", date: "2026-10-12", amount: 612.4, overdue: false, itemKey: "d" }], ctx),
};

mkdirSync(outDir, { recursive: true });
for (const [name, email] of Object.entries(emails)) {
  writeFileSync(path.join(outDir, `${name}.html`), email.html);
  writeFileSync(path.join(outDir, `${name}.txt`), `Oggetto: ${email.subject}\n\n${email.text}\n`);
}
console.log(`Anteprime scritte in ${outDir}`);
