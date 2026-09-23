import {
  SYNC_JOB_TTL_SECONDS,
  SYNC_LOCK_TTL_SECONDS,
  deriveJobStatus,
  type SyncJob,
  type SyncJobAccount,
  type SyncJobAccountPatch,
  type SyncJobKind,
} from "./types";

/** Primitive KV minime su cui gira lo store dei job — Redis in produzione, una Map nei test. */
export interface SyncJobKv {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  /** Scrive solo se la chiave non esiste; true se ha scritto. */
  setIfAbsent(key: string, value: string, ttlSeconds: number): Promise<boolean>;
  del(key: string): Promise<void>;
  addToSet(key: string, member: string, ttlSeconds: number): Promise<void>;
  setMembers(key: string): Promise<string[]>;
}

export interface SyncJobStore {
  createJob(input: { userId: string; kind: SyncJobKind; accounts?: SyncJobAccount[] }): Promise<SyncJob>;
  setAccounts(userId: string, jobId: string, accounts: SyncJobAccount[]): Promise<void>;
  updateAccount(userId: string, jobId: string, accountId: string, patch: SyncJobAccountPatch): Promise<void>;
  listJobs(userId: string): Promise<SyncJob[]>;
  dismissJob(userId: string, jobId: string): Promise<boolean>;
  acquireAccountLock(accountId: string): Promise<boolean>;
  releaseAccountLock(accountId: string): Promise<void>;
}

interface StoredJobMeta {
  id: string;
  userId: string;
  kind: SyncJobKind;
  startedAt: string;
  updatedAt: string;
  dismissed: boolean;
  accountIds: string[];
}

interface StoredJobAccount extends SyncJobAccount {
  updatedAt: string;
}

const jobKey = (userId: string, jobId: string) => `sync-job:${userId}:${jobId}`;
const accountKey = (userId: string, jobId: string, accountId: string) =>
  `sync-job:${userId}:${jobId}:account:${accountId}`;
const indexKey = (userId: string) => `sync-jobs:${userId}`;
const lockKey = (accountId: string) => `sync-lock:${accountId}`;

function withoutUndefined<T extends object>(patch: T): Partial<T> {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) as Partial<T>;
}

/**
 * Store dei job di sync. Metadati e conti vivono in chiavi separate: i conti di un job si
 * sincronizzano in parallelo e ognuno scrive solo la propria chiave, così nessun aggiornamento
 * si perde. Stato e heartbeat del job si calcolano in lettura.
 */
export function createSyncJobStore(kv: SyncJobKv, clock: () => Date = () => new Date()): SyncJobStore {
  async function readMeta(userId: string, jobId: string): Promise<StoredJobMeta | null> {
    const raw = await kv.get(jobKey(userId, jobId));
    return raw ? (JSON.parse(raw) as StoredJobMeta) : null;
  }

  async function writeAccounts(userId: string, jobId: string, accounts: SyncJobAccount[], now: string) {
    await Promise.all(
      accounts.map((account) =>
        kv.set(accountKey(userId, jobId, account.accountId), JSON.stringify({ ...account, updatedAt: now }), SYNC_JOB_TTL_SECONDS)
      )
    );
  }

  async function assemble(meta: StoredJobMeta): Promise<SyncJob> {
    const rawAccounts = await Promise.all(meta.accountIds.map((id) => kv.get(accountKey(meta.userId, meta.id, id))));
    const stored = rawAccounts.filter((raw): raw is string => raw !== null).map((raw) => JSON.parse(raw) as StoredJobAccount);
    const updatedAt = stored.reduce((latest, account) => (account.updatedAt > latest ? account.updatedAt : latest), meta.updatedAt);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const accounts: SyncJobAccount[] = stored.map(({ updatedAt: _ignored, ...account }) => account);
    return {
      id: meta.id,
      userId: meta.userId,
      kind: meta.kind,
      status: deriveJobStatus(accounts),
      dismissed: meta.dismissed,
      startedAt: meta.startedAt,
      updatedAt,
      accounts,
    };
  }

  return {
    async createJob({ userId, kind, accounts = [] }) {
      const now = clock().toISOString();
      const meta: StoredJobMeta = {
        id: crypto.randomUUID(),
        userId,
        kind,
        startedAt: now,
        updatedAt: now,
        dismissed: false,
        accountIds: accounts.map((account) => account.accountId),
      };
      await kv.set(jobKey(userId, meta.id), JSON.stringify(meta), SYNC_JOB_TTL_SECONDS);
      await writeAccounts(userId, meta.id, accounts, now);
      await kv.addToSet(indexKey(userId), meta.id, SYNC_JOB_TTL_SECONDS);
      return assemble(meta);
    },

    async setAccounts(userId, jobId, accounts) {
      const meta = await readMeta(userId, jobId);
      if (!meta) return;
      const now = clock().toISOString();
      await writeAccounts(userId, jobId, accounts, now);
      const updated: StoredJobMeta = { ...meta, updatedAt: now, accountIds: accounts.map((account) => account.accountId) };
      await kv.set(jobKey(userId, jobId), JSON.stringify(updated), SYNC_JOB_TTL_SECONDS);
    },

    async updateAccount(userId, jobId, accountId, patch) {
      const key = accountKey(userId, jobId, accountId);
      const raw = await kv.get(key);
      if (!raw) return;
      const current = JSON.parse(raw) as StoredJobAccount;
      const next: StoredJobAccount = { ...current, ...withoutUndefined(patch), updatedAt: clock().toISOString() };
      await kv.set(key, JSON.stringify(next), SYNC_JOB_TTL_SECONDS);
    },

    async listJobs(userId) {
      const ids = await kv.setMembers(indexKey(userId));
      const metas = await Promise.all(ids.map((id) => readMeta(userId, id)));
      const jobs = await Promise.all(metas.filter((meta): meta is StoredJobMeta => meta !== null).map(assemble));
      return jobs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    },

    async dismissJob(userId, jobId) {
      const meta = await readMeta(userId, jobId);
      if (!meta) return false;
      await kv.set(jobKey(userId, jobId), JSON.stringify({ ...meta, dismissed: true }), SYNC_JOB_TTL_SECONDS);
      return true;
    },

    acquireAccountLock: (accountId) => kv.setIfAbsent(lockKey(accountId), "1", SYNC_LOCK_TTL_SECONDS),

    releaseAccountLock: (accountId) => kv.del(lockKey(accountId)),
  };
}

/** KV in memoria per i test (nessuna scadenza: i test non ne dipendono). */
export function createMemorySyncJobKv(): SyncJobKv {
  const values = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  return {
    async get(key) {
      return values.get(key) ?? null;
    },
    async set(key, value) {
      values.set(key, value);
    },
    async setIfAbsent(key, value) {
      if (values.has(key)) return false;
      values.set(key, value);
      return true;
    },
    async del(key) {
      values.delete(key);
    },
    async addToSet(key, member) {
      const set = sets.get(key) ?? new Set<string>();
      set.add(member);
      sets.set(key, set);
    },
    async setMembers(key) {
      return [...(sets.get(key) ?? [])];
    },
  };
}
