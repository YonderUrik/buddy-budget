import { computeConnectionHealth, needsRenewal } from "@/lib/gocardless/connection-health";
import type { DebtDueItem } from "@/lib/debts/view";
import { todayIso } from "@/lib/debts/dates";
import type { SidebarDeadline } from "./types";

/** Quante scadenze mostra la sidebar: è un promemoria, l'elenco completo sta nelle sezioni. */
export const MAX_SIDEBAR_DEADLINES = 4;
/** Indirizzo che apre subito il rinnovo del collegamento bancario (vedi `LiquidityShell`). */
export const RENEWAL_HREF = "/liquidita/conti?rinnova=sidebar";

export interface SidebarConnectionInput {
  id: string;
  institutionName: string;
  status: "pending" | "linked" | "expired" | "error";
  consentExpiresAt: Date | string | null;
}

export interface BuildSidebarDeadlinesInput {
  debtDue: DebtDueItem[];
  connections: SidebarConnectionInput[];
  now: Date;
  limit?: number;
}

/**
 * Unisce rate e rinnovi in un unico elenco per data: le scadute (o in errore) vengono per prime perché hanno data
 * passata o di oggi. Pura: la sidebar e i test usano la stessa funzione.
 */
export function buildSidebarDeadlines({ debtDue, connections, now, limit = MAX_SIDEBAR_DEADLINES }: BuildSidebarDeadlinesInput): SidebarDeadline[] {
  const today = todayIso(now);
  const rates: SidebarDeadline[] = debtDue.map((d) => ({
    id: `rata:${d.debtId}`,
    kind: "rata",
    label: d.name,
    date: d.date,
    amount: d.amount,
    overdue: d.overdue,
    href: `/debiti/finanziamenti?id=${d.debtId}`,
  }));
  const renewals: SidebarDeadline[] = connections.flatMap((c) => {
    const health = computeConnectionHealth(c, now);
    if (!needsRenewal(health.state)) return [];
    const expiry = c.consentExpiresAt ? todayIso(new Date(c.consentExpiresAt)) : today;
    const date = health.state === "expiring" ? expiry : today;
    return [
      {
        id: `rinnovo:${c.id}`,
        kind: "rinnovo" as const,
        label: `Rinnova ${c.institutionName}`,
        date,
        amount: null,
        overdue: health.state !== "expiring",
        href: RENEWAL_HREF,
      },
    ];
  });
  return [...rates, ...renewals].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)).slice(0, limit);
}
