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
  olderThan,
  planConnectionCleanup,
  planRemoteSweep,
  type CleanupConnection,
  type CleanupPolicy,
} from "./cleanup-plan";
import { GoCardlessError, deleteAgreement, deleteRequisition, getRequisition, listAgreements, listRequisitions } from "./client";
import { gocardlessOwnRedirectUrls } from "./redirect";

export interface CleanupOptions {
  /** `dry-run`: calcola e registra cosa eliminerebbe, senza toccare GoCardless né le righe. */
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
  const { mode, deleteUnknown = false, approvedRequisitionIds = new Set<string>(), now = new Date(), policy = DEFAULT_CLEANUP_POLICY } = options;
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
  const knownConnectionIds = new Set(connections.map((connection) => connection.id));
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
    let kind = action.kind;
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
          // Consenso dato ma la callback non è mai arrivata (o la scelta dei conti abbandonata): nessun conto in app.
          // Si tratta come una connessione orfana: grazia da quando lo si vede, poi si elimina.
          if (!action.orphanedAt) {
            await db.update(bankConnections).set({ orphanedAt: now }).where(eq(bankConnections.id, action.connectionId));
          }
          if (!action.orphanedAt || !olderThan(action.orphanedAt, policy.orphanGraceDays, now)) {
            bump("skipped_linked");
            log.warn("gocardless.cleanup.skipped_linked", { connectionId: action.connectionId, reason: action.kind });
            continue;
          }
          kind = "orphan_connection";
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
      bump(kind);
      log.info(mode === "execute" ? "gocardless.cleanup.deleted" : "gocardless.cleanup.candidate", {
        connectionId: action.connectionId,
        reason: kind,
      });
    } catch (error) {
      fail("gocardless.cleanup.failed", { connectionId: action.connectionId, reason: kind, error });
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
      log.info("gocardless.cleanup.linked_unknown", {
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
          log.info(target.mode === "execute" ? "gocardless.cleanup.deleted" : "gocardless.cleanup.candidate", {
            requisitionId: target.id,
            reason: target.kind,
          });
        }
      } catch (error) {
        fail("gocardless.cleanup.failed", { reason: target.kind, error });
      }
    }
    if (targets.length > 0 || sweep.linkedUnknown.length > 0) {
      log.info("gocardless.cleanup.unknown_found", { count: targets.length + sweep.linkedUnknown.length, reason: foreignMode });
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

/** Return URLs of this app (web and phone app), to recognise our requisitions; without APP_URL none counts as ours. */
function ownRedirectUrl(): string[] | undefined {
  try {
    return gocardlessOwnRedirectUrls();
  } catch {
    return undefined;
  }
}

function sumCounts(counts: CleanupReport["counts"]): number {
  return Object.values(counts).reduce((total, n) => total + (n ?? 0), 0);
}
