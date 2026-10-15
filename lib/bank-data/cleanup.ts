import "server-only";
import { and, count, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";
import {
  logger as appLogger,
  recordBankCleanup,
  type CleanupAction,
  type CleanupMode,
  type Logger,
} from "@/lib/observability";
import {
  DEFAULT_CLEANUP_POLICY,
  MAX_DELETIONS_PER_RUN,
  olderThan,
  planConnectionCleanup,
  planRemoteSweep,
  type CleanupConnection,
  type CleanupPolicy,
} from "./cleanup-plan";
import { deleteAgreement, deleteRequisition, listAgreements, listRequisitions } from "./gocardless/client";
import { getBankProvider } from "./providers";
import { gocardlessRedirectUrl } from "./redirect";

export interface CleanupOptions {
  /** `dry-run`: calcola e registra cosa eliminerebbe, senza toccare i fornitori né le righe. */
  mode: CleanupMode;
  /** Consente di eliminare requisition/agreement di altri ambienti che a DB non risultano (spento di default: vedi `planRemoteSweep`). */
  deleteUnknown?: boolean;
  /**
   * Requisition sconosciute in stato LN che l'utente ha approvato una per una (`GOCARDLESS_CLEANUP_APPROVED_REQUISITIONS`):
   * le uniche LN che la pulizia elimina. Un id che a DB risulta non si tocca mai.
   */
  approvedRequisitionIds?: ReadonlySet<string>;
  now?: Date;
  policy?: CleanupPolicy;
  log?: Logger;
}

export interface CleanupReport {
  mode: CleanupMode;
  /** Elementi per azione: in dry-run sono i candidati, in execute quelli eliminati. */
  counts: Partial<Record<CleanupAction, number>>;
  failed: number;
}

async function loadConnections(): Promise<CleanupConnection[]> {
  const rows = await db
    .select({
      id: bankConnections.id,
      provider: bankConnections.provider,
      status: bankConnections.status,
      requisitionId: bankConnections.requisitionId,
      consentExpiresAt: bankConnections.consentExpiresAt,
      createdAt: bankConnections.createdAt,
      orphanedAt: bankConnections.orphanedAt,
      deletionScheduledAt: authUser.deletionScheduledAt,
      linkCount: count(bankAccountLinks.id),
    })
    .from(bankConnections)
    .innerJoin(authUser, eq(bankConnections.userId, authUser.id))
    .leftJoin(bankAccountLinks, eq(bankAccountLinks.connectionId, bankConnections.id))
    .groupBy(bankConnections.id, authUser.deletionScheduledAt);
  return rows.map(({ deletionScheduledAt, ...row }) => ({ ...row, userDeactivated: deletionScheduledAt !== null }));
}

/**
 * Pulizia dei consensi bancari: revoca presso il fornitore di ogni connessione i tentativi mai completati, le
 * connessioni senza più conti e quelle scadute da tempo (criteri e grazie in `cleanup-plan.ts`). Solo per GoCardless,
 * che li elenca, segnala/elimina anche le requisition che a DB non risultano (Enable Banking non ha un elenco delle
 * sessioni). Ogni eliminazione è idempotente (già sparito = già fatto). Un errore su un elemento non ferma gli altri.
 */
export async function runBankCleanup(options: CleanupOptions): Promise<CleanupReport> {
  const { mode, deleteUnknown = false, approvedRequisitionIds = new Set<string>(), now = new Date(), policy = DEFAULT_CLEANUP_POLICY } = options;
  const log = (options.log ?? appLogger).child({ phase: "cleanup" });
  const report: CleanupReport = { mode, counts: {}, failed: 0 };
  let remainingDeletions = MAX_DELETIONS_PER_RUN;
  let capped = 0;

  const bump = (action: CleanupAction, effectiveMode: CleanupMode = mode) => {
    report.counts[action] = (report.counts[action] ?? 0) + 1;
    recordBankCleanup(action, effectiveMode);
  };
  const fail = (event: string, fields: { connectionId?: string; provider?: string; reason?: string; error: unknown }) => {
    report.failed += 1;
    recordBankCleanup("failed", mode);
    log.warn(event, fields);
  };
  /** Prende un posto nel tetto di eliminazioni; false se esaurito (e lo conta). */
  const takeSlot = (): boolean => {
    if (remainingDeletions <= 0) {
      capped += 1;
      return false;
    }
    remainingDeletions -= 1;
    return true;
  };

  // Snapshot remoto (solo GoCardless) prima di toccare nulla, così le eliminazioni sotto non falsano il confronto.
  // Senza chiavi GoCardless (passati del tutto a Enable Banking) non c'è nulla da elencare.
  let remote: { requisitions: Awaited<ReturnType<typeof listRequisitions>>; agreements: Awaited<ReturnType<typeof listAgreements>> } | null = null;
  if (getBankProvider("gocardless").isConfigured()) {
    try {
      remote = { requisitions: await listRequisitions(), agreements: await listAgreements() };
    } catch (error) {
      fail("bank.cleanup.list_failed", { provider: "gocardless", error });
    }
  }

  // Gli id noti vanno letti prima di eliminare: le connessioni appena pulite non devono risultare "sconosciute".
  const known = new Set(
    (
      await db
        .select({ id: bankConnections.requisitionId })
        .from(bankConnections)
        .where(and(isNotNull(bankConnections.requisitionId), eq(bankConnections.provider, "gocardless")))
    ).map((row) => row.id!)
  );
  const connections = await loadConnections();
  const knownConnectionIds = new Set(connections.map((connection) => connection.id));
  const plan = planConnectionCleanup(connections, now, policy);

  if (plan.markOrphaned.length > 0) {
    await db.update(bankConnections).set({ orphanedAt: now }).where(inArray(bankConnections.id, plan.markOrphaned));
    log.info("bank.cleanup.orphans_marked", { count: plan.markOrphaned.length });
  }
  if (plan.clearOrphaned.length > 0) {
    await db.update(bankConnections).set({ orphanedAt: null }).where(inArray(bankConnections.id, plan.clearOrphaned));
  }

  for (const action of plan.actions) {
    if (!takeSlot()) continue;
    let kind = action.kind;
    const provider = getBankProvider(action.provider);
    try {
      if (action.requisitionId && action.kind === "abandoned_attempt") {
        // Un tentativo che il fornitore dice completato (callback non arrivata): non è abbandonato, non si tocca.
        const remoteStatus = await provider.consentStatus(action.requisitionId);
        if (remoteStatus === "linked") {
          // Consenso dato ma la callback non è mai arrivata (o la scelta dei conti abbandonata): nessun conto in app.
          // Si tratta come una connessione orfana: grazia da quando lo si vede, poi si elimina.
          if (!action.orphanedAt) {
            await db.update(bankConnections).set({ orphanedAt: now }).where(eq(bankConnections.id, action.connectionId));
          }
          if (!action.orphanedAt || !olderThan(action.orphanedAt, policy.orphanGraceDays, now)) {
            bump("skipped_linked");
            log.warn("bank.cleanup.skipped_linked", { provider: action.provider, connectionId: action.connectionId, reason: action.kind });
            continue;
          }
          kind = "orphan_connection";
        }
      }
      if (mode === "execute") {
        if (action.requisitionId) await provider.revokeConsent(action.requisitionId);
        if (action.deleteRow) {
          await db.delete(bankConnections).where(eq(bankConnections.id, action.connectionId));
        } else {
          await db.update(bankConnections).set({ requisitionId: null }).where(eq(bankConnections.id, action.connectionId));
        }
      }
      bump(kind);
      log.info(mode === "execute" ? "bank.cleanup.deleted" : "bank.cleanup.candidate", {
        provider: action.provider,
        connectionId: action.connectionId,
        reason: kind,
      });
    } catch (error) {
      fail("bank.cleanup.failed", { provider: action.provider, connectionId: action.connectionId, reason: kind, error });
    }
  }

  if (remote) {
    const sweep = planRemoteSweep({ ...remote, knownRequisitionIds: known, knownConnectionIds, ownRedirect: ownRedirectUrl() }, now, policy);
    const foreignMode: CleanupMode = mode === "execute" && deleteUnknown ? "execute" : "dry-run";
    const approved = sweep.linkedUnknown.filter((requisition) => approvedRequisitionIds.has(requisition.id));
    // Le LN sconosciute non si eliminano da sole: ognuna finisce nei log con id e origine, per approvarla a mano.
    for (const requisition of sweep.linkedUnknown) {
      if (approvedRequisitionIds.has(requisition.id)) continue;
      bump("skipped_linked");
      log.info("bank.cleanup.linked_unknown", {
        provider: "gocardless",
        requisitionId: requisition.id,
        reason: requisition.origin,
        ageDays: requisition.ageDays,
        host: requisition.redirectHost ?? undefined,
      });
    }
    const targets = [
      ...sweep.staleRequisitionIds.map((id) => ({ id, kind: "stale_requisition" as const, mode })),
      ...approved.map(({ id }) => ({ id, kind: "approved_requisition" as const, mode })),
      ...sweep.requisitionIds.map((id) => ({ id, kind: "unknown_requisition" as const, mode: foreignMode })),
      ...sweep.agreementIds.map((id) => ({ id, kind: "unknown_agreement" as const, mode: foreignMode })),
    ];
    for (const target of targets) {
      if (target.mode === "execute" && !takeSlot()) continue;
      try {
        if (target.mode === "execute") {
          if (target.kind === "unknown_agreement") await deleteAgreement(target.id);
          else await deleteRequisition(target.id);
        }
        bump(target.kind, target.mode);
        if (target.kind !== "unknown_agreement") {
          log.info(target.mode === "execute" ? "bank.cleanup.deleted" : "bank.cleanup.candidate", {
            provider: "gocardless",
            requisitionId: target.id,
            reason: target.kind,
          });
        }
      } catch (error) {
        fail("bank.cleanup.failed", { provider: "gocardless", reason: target.kind, error });
      }
    }
    if (targets.length > 0 || sweep.linkedUnknown.length > 0) {
      log.info("bank.cleanup.unknown_found", { count: targets.length + sweep.linkedUnknown.length, reason: foreignMode });
    }
  }

  if (capped > 0) {
    for (let i = 0; i < capped; i += 1) recordBankCleanup("capped", mode);
    report.counts.capped = capped;
    log.warn("bank.cleanup.capped", { count: capped });
  }
  log.info("bank.cleanup.completed", { outcome: report.failed > 0 ? "error" : "success", count: sumCounts(report.counts), reason: mode });
  return report;
}

/** URL di ritorno di questa app, per riconoscere le nostre requisition; senza APP_URL nessuna risulta nostra. */
function ownRedirectUrl(): string | undefined {
  try {
    return gocardlessRedirectUrl();
  } catch {
    return undefined;
  }
}

function sumCounts(counts: CleanupReport["counts"]): number {
  return Object.values(counts).reduce((total, n) => total + (n ?? 0), 0);
}
