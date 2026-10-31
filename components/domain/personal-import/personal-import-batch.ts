/**
 * Several files of the same bank in one upload: which files to keep, and how to send them so they all land in one
 * source. Pure (the network call is passed in), so it can be tested.
 */

/** Files sent together at most; the server allows the same number in analysis at once. */
export const PERSONAL_IMPORT_MAX_FILES = 10;

export interface BatchFile {
  name: string;
  size: number;
  csv: string;
}

/** Outcome of one batch: the jobs created, the files already imported, the files the server refused. */
export interface BatchResult<F extends BatchFile = BatchFile> {
  queued: { id: string; file: F }[];
  alreadyImported: F[];
  failed: { file: F; message: string }[];
}

/** Adds `incoming` to `current`, dropping the same file chosen twice and anything past the limit. */
export function addFiles<F extends BatchFile>(current: F[], incoming: F[], max = PERSONAL_IMPORT_MAX_FILES): { files: F[]; dropped: number } {
  const files = [...current];
  let dropped = 0;
  for (const file of incoming) {
    if (files.some(f => f.name === file.name && f.size === file.size && f.csv === file.csv)) continue;
    if (files.length >= max) { dropped += 1; continue; }
    files.push(file);
  }
  return { files, dropped };
}

/**
 * Sends the files one after another. A new bank is created by the first accepted file; the next ones go to that
 * same source (`formatId` from the answer), so five exports of one bank never become five banks with one name.
 */
export async function sendBatch<F extends BatchFile>(
  files: F[],
  formatId: string | undefined,
  send: (file: F, formatId: string | undefined) => Promise<{ id: string; formatId?: string }>,
  isAlreadyImported: (error: unknown) => boolean,
): Promise<BatchResult<F>> {
  const result: BatchResult<F> = { queued: [], alreadyImported: [], failed: [] };
  let target = formatId;
  for (const file of files) {
    try {
      const job = await send(file, target);
      target ??= job.formatId;
      result.queued.push({ id: job.id, file });
    } catch (error) {
      if (isAlreadyImported(error)) result.alreadyImported.push(file);
      else result.failed.push({ file, message: error instanceof Error ? error.message : String(error) });
    }
  }
  return result;
}

/** The fields of a listed job the receipt reads. */
export interface BatchJob {
  id: string;
  formatId: string;
  status: string;
  estimatedAt: string;
  expiresAt: string;
  createdAt: string;
  error: string | null;
  notifiedAt: string | null;
  results: { cash: number; investments: number; skipped: number; bankCategorized: number; rows?: number; alreadyPresent?: number; native?: { name: string; inserted: number } } | null;
}
const RUNNING_ORDER = ["queued", "processing", "ready"];

/**
 * One job standing for a whole batch, for the receipt: running while any file is (at the least advanced step),
 * failed only when no file was imported, otherwise imported with the totals summed. `failedFiles` counts the files
 * of an imported batch that did not make it. Undefined while the listing has not caught up with the new jobs.
 */
export function combineJobs<J extends BatchJob>(jobs: (J | undefined)[]): { job: J | undefined; failedFiles: number } {
  if (!jobs.length || jobs.some(j => !j)) return { job: undefined, failedFiles: 0 };
  const known = jobs as J[];
  if (known.length === 1) return { job: known[0], failedFiles: 0 };
  const running = known.filter(j => RUNNING_ORDER.includes(j.status)).sort((a, b) => RUNNING_ORDER.indexOf(a.status) - RUNNING_ORDER.indexOf(b.status));
  if (running.length) return { job: running[0], failedFiles: 0 };
  const imported = known.filter(j => j.status === "imported");
  if (!imported.length) return { job: known[0], failedFiles: 0 };
  const counted = imported.every(j => j.results?.rows !== undefined && j.results?.alreadyPresent !== undefined);
  const sum = (key: "cash" | "investments" | "skipped" | "bankCategorized" | "rows" | "alreadyPresent") => imported.reduce((n, j) => n + (j.results?.[key] ?? 0), 0);
  const natives = imported.flatMap(j => j.results?.native ? [j.results.native] : []);
  const native = natives.length ? { name: natives[0].name, inserted: natives.reduce((n, x) => n + x.inserted, 0) } : undefined;
  const results = { cash: sum("cash"), investments: sum("investments"), skipped: sum("skipped"), bankCategorized: sum("bankCategorized"), ...(counted ? { rows: sum("rows"), alreadyPresent: sum("alreadyPresent") } : {}), ...(native ? { native } : {}) };
  return { job: { ...imported[0], results }, failedFiles: known.length - imported.length };
}
