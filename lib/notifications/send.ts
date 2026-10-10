import "server-only";
import { Resend } from "resend";
import { unsubscribeApiUrl } from "./token";
import type { BuiltEmail } from "./emails";

/**
 * Invia un'email non di servizio con le intestazioni `List-Unsubscribe` e `List-Unsubscribe-Post` (RFC 8058):
 * Gmail, Apple Mail e gli altri mostrano «Annulla l'iscrizione» e la disiscrizione parte con un POST, senza login.
 * Restituisce true se Resend ha accettato il messaggio.
 */
export async function sendNotificationEmail(to: string, email: BuiltEmail, options: { appUrl: string; unsubscribeToken: string }): Promise<boolean> {
  const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: process.env.RESEND_FROM!,
    to,
    subject: email.subject,
    text: email.text,
    html: email.html,
    headers: {
      "List-Unsubscribe": `<${unsubscribeApiUrl(options.appUrl, options.unsubscribeToken)}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
  return !error;
}
