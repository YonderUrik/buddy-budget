import "server-only";
import { count, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";
import {
  logger as appLogger,
  recordGoCardlessCleanup,
  type CleanupAction,
  type CleanupMode,
  type Logger,
} from "@/lib/observability";
import {
  DEFAULT_CLEANUP_POLICY,
  MAX_DELETIONS_PER_RUN,
  planConnectionCleanup,
  planRemoteSweep,
  type CleanupConnection,
  type CleanupPolicy,
} from "./cleanup-plan";
import { GoCardlessError, deleteAgreement, deleteRequisition, getRequisition, listAgreements, listRequisitions } from "./client";

export interface CleanupOptions {
  /** `dry-run`: calcola e registra cosa eliminerebbe, senza toccare GoCardless né le righe. */
  mode: CleanupMode;
  /** Consente di eliminare requisition/agreement che a DB non risultano (spento di default: vedi `planRemoteSweep`). */
  deleteUnknown?: boolean;
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
 * Pulizia della lista GoCardless: elimina requisition di tentativi mai completati, connessioni senza più
 * conti e connessioni scadute da tempo (criteri e grazie in `cleanup-plan.ts`), e segnala/elimina quelle che
 * a DB non risultano. Ogni eliminazione è idempotente (404 = già fatto). Un errore su un elemento non ferma gli altri.
 */
export async function runGoCardlessCleanup(options: CleanupOptions): Promise<CleanupReport> {
  const { mode, deleteUnknown = false, now = new Date(), policy = DEFAULT_CLEANUP_POLICY } = options;
  const log = (options.log ?? appLogger).child({ phase: "cleanup" });
  const report: CleanupReport = { mode, counts: {}, failed: 0 };
  let remainingDeletions = MAX_DELETIONS_PER_RUN;
  let capped = 0;

  const bump = (action: CleanupAction, effectiveMode: CleanupMode = mode) => {
    report.counts[action] = (report.counts[action] ?? 0) + 1;
    recordGoCardlessCleanup(action, effectiveMode);
  };
  const fail = (event: string, fields: { connectionId?: string; reason?: string; error: unknown }) => {
    report.failed += 1;
    recordGoCardlessCleanup("failed", mode);
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

  // Snapshot remoto prima di toccare nulla, così le eliminazioni sotto non falsano il confronto.
  let remote: { requisitions: Awaited<ReturnType<typeof listRequisitions>>; agreements: Awaited<ReturnType<typeof listAgreements>> } | null = null;
  try {
    remote = { requisitions: await listRequisitions(), agreements: await listAgreements() };
  } catch (error) {
    fail("gocardless.cleanup.list_failed", { error });
  }

  // Gli id noti vanno letti prima di eliminare: le connessioni appena pulite non devono risultare "sconosciute".
  const known = new Set(
    (await db.select({ id: bankConnections.requisitionId }).from(bankConnections).where(isNotNull(bankConnections.requisitionId))).map((row) => row.id!)
  );
  const connections = await loadConnections();
  const plan = planConnectionCleanup(connections, now, policy);

  if (plan.markOrphaned.length > 0) {
    await db.update(bankConnections).set({ orphanedAt: now }).where(inArray(bankConnections.id, plan.markOrphaned));
    log.info("gocardless.cleanup.orphans_marked", { count: plan.markOrphaned.length });
  }
  if (plan.clearOrphaned.length > 0) {
    await db.update(bankConnections).set({ orphanedAt: null }).where(inArray(bankConnections.id, plan.clearOrphaned));
  }

  for (const action of plan.actions) {
    if (!takeSlot()) continue;
    try {
      if (action.requisitionId && action.kind === "abandoned_attempt") {
        // Un tentativo che GoCardless dice completato (callback non arrivata): non è abbandonato, non si tocca.
        const remoteStatus = await getRequisition(action.requisitionId).then(
          (requisition) => requisition.status,
          (error) => {
            if (error instanceof GoCardlessError && error.status === 404) return null;
            throw error;
          }
        );
        if (remoteStatus === "LN") {
          bump("skipped_linked");
          log.warn("gocardless.cleanup.skipped_linked", { connectionId: action.connectionId, reason: action.kind });
          continue;
        }
      }
      if (mode === "execute") {
        if (action.requisitionId) await deleteRequisition(action.requisitionId);
        if (action.deleteRow) {
          await db.delete(bankConnections).where(eq(bankConnections.id, action.connectionId));
        } else {
          await db.update(bankConnections).set({ requisitionId: null }).where(eq(bankConnections.id, action.connectionId));
        }
      }
      bump(action.kind);
      log.info(mode === "execute" ? "gocardless.cleanup.deleted" : "gocardless.cleanup.candidate", {
        connectionId: action.connectionId,
        reason: action.kind,
      });
    } catch (error) {
      fail("gocardless.cleanup.failed", { connectionId: action.connectionId, reason: action.kind, error });
    }
  }

  if (remote) {
    const sweep = planRemoteSweep({ ...remote, knownRequisitionIds: known }, now, policy);
    const sweepMode: CleanupMode = mode === "execute" && deleteUnknown ? "execute" : "dry-run";
    for (let i = 0; i < sweep.linkedUnknown; i += 1) bump("skipped_linked", sweepMode);
    const targets = [
      ...sweep.requisitionIds.map((id) => ({ id, kind: "unknown_requisition" as const })),
      ...sweep.agreementIds.map((id) => ({ id, kind: "unknown_agreement" as const })),
    ];
    for (const target of targets) {
      if (sweepMode === "execute" && !takeSlot()) continue;
      try {
        if (sweepMode === "execute") {
          if (target.kind === "unknown_requisition") await deleteRequisition(target.id);
          else await deleteAgreement(target.id);
        }
        bump(target.kind, sweepMode);
      } catch (error) {
        fail("gocardless.cleanup.failed", { reason: target.kind, error });
      }
    }
    if (targets.length > 0 || sweep.linkedUnknown > 0) {
      log.info("gocardless.cleanup.unknown_found", { count: targets.length, reason: sweepMode });
    }
  }

  if (capped > 0) {
    for (let i = 0; i < capped; i += 1) recordGoCardlessCleanup("capped", mode);
    report.counts.capped = capped;
    log.warn("gocardless.cleanup.capped", { count: capped });
  }
  log.info("gocardless.cleanup.completed", { outcome: report.failed > 0 ? "error" : "success", count: sumCounts(report.counts), reason: mode });
  return report;
}

function sumCounts(counts: CleanupReport["counts"]): number {
  return Object.values(counts).reduce((total, n) => total + (n ?? 0), 0);
}
