# Support

Feature area(s): Help page (Aiuto) contact form; "Write to us" button; "Report this error" link under error messages/toasts
Source: `app/api/support/route.ts`, `lib/support/{constants,report,send}.ts`

## Endpoints

| Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|
| POST | `/api/support` | Send a support report (problem / question / idea) to the support mailbox | session | rate-limited 5/hour (Redis) |

## POST /api/support
Route name: `support.report` · Auth: session cookie required · Guards: none (no demo guard, no country gate)

**Request body** (`application/json`, `reportInputSchema`)
```ts
interface ReportInput {
  kind: "problema" | "domanda" | "idea";
  message: string;            // trimmed, 10..4000 chars ("Scrivi qualche parola in più." if < 10)
  context?: {                 // omit if the user removed context
    path: string;             // max 120; server keeps only the path part (no query/hash)
    version: string;          // max 40 — app version (mobile: e.g. "ios-1.2.0 (45)")
    viewport: string;         // regex ^\d{2,5}x\d{2,5}$, e.g. "390x844"
    theme: "chiaro" | "scuro";
  };
  source?: "pagina" | "pulsante" | "errore";   // where the report started
  error?: {                   // only when started from an error message
    area: "import_movimenti" | "import_investimenti" | "sync_banca" | "collega_banca" | "movimento"
        | "operazione" | "conto" | "debito" | "abbonamento" | "pensione" | "obiettivo" | "caricamento" | "salvataggio";
    message: string;          // trimmed, max 300 — the message shown to the user
  };
}
```

**Response** `201 { "reference": "SUP-7K2QF9" }` — `SUP-` + 6 chars from `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`; show it to the user.

**Errors**
| Status | Body | When |
|---|---|---|
| 401 | empty | no session |
| 400 | `{ error: <first zod issue> }` (fallback "Segnalazione non valida.") | validation |
| 429 | `{ error: "Hai già inviato diverse segnalazioni: riprova tra un po'." }` | > 5 reports per user per hour (`REPORT_RATE_LIMIT`, Redis key `support:report:{userId}`, fixed window from first report; fails open if Redis down) |
| 502 | `{ error: "Non siamo riusciti a inviare la segnalazione. Riprova o scrivi a support@buddybudget.io." }` | Resend failure or email not configured |

**Side effects**: email via Resend to `SUPPORT_EMAIL_TO` (default `support@buddybudget.io`) with `replyTo` = user email; body includes context lines and the request `User-Agent` (truncated to 200). Metric `recordSupportReport(kind, outcome)`; logs never include the text or email.

**Mobile notes**: the quota is consumed BEFORE sending (a 502 still uses one of the 5). Public constants for a fallback UI: `SUPPORT_EMAIL = "support@buddybudget.io"`, status page `https://stats.uptimerobot.com/BCuTWm0Ukg`, repo `https://github.com/YonderUrik/buddy-budget`. Send a meaningful `User-Agent`.
