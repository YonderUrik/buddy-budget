import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { accounts } from "@/lib/db/schema/accounts";
import { transactions } from "@/lib/db/schema/transactions";
import { instruments, investmentTransactions, investmentPortfolios } from "@/lib/db/schema/investments";
import { personalFormats as formats, personalImportJobs as jobs, personalParsers as parsers } from "@/lib/db/schema/personal-imports";
import { enqueue, getPreview, listImports } from "./jobs";
import { deletePersonalImport, previewPersonalImportDeletion } from "./delete";
import { confirmImport } from "./confirm";
import { processOne, maintainJobs } from "./worker";
import { generateParser } from "./generate";
import { exportPersonalImports } from "./export";
const send = vi.hoisted(() => vi.fn().mockResolvedValue({ data: { id: "synthetic" }, error: null }));
vi.mock("resend", () => ({ Resend: class { emails = { send }; } }));
vi.mock("./generate", async importOriginal => ({ ...await importOriginal<typeof import("./generate")>(), generateParser: vi.fn() }));
const code = `function(t){return t.rows.map((line,row)=>{const r=line[0].split(',');return r[0]==='Date'?{row,kind:'ignore',reason:'Header'}:r[1]==='ERROR'?{row,kind:'error',reason:'Unknown operation'}:r[1]==='NOTE'?{row,kind:'ignore',reason:'Metadata'}:r[1]==='CASH'?{row,kind:'cash',date:r[0],amount:Number(r[2]),description:r[3],currency:'EUR',transfer:false}:{row,kind:'investment',date:r[0],currency:'EUR',description:r[3],type:r[1]==='BUY'?'acquisto':'vendita',name:r[3],isin:null,instrumentType:'azione',quantity:Number(r[2]),price:100,grossAmount:null,fees:0,taxes:0}})}`;
const csv = 'Date,Type,Value,Description\n2024-01-01,CASH,1000,Deposit\n2024-01-02,BUY,1,Example shares\n2024-01-03,CASH,-5,Shop';
let userId: string; const users: string[] = [];
beforeEach(async () => {
  vi.stubEnv("PERSONAL_CSV_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
  vi.stubEnv("RESEND_API_KEY", "synthetic"); vi.stubEnv("RESEND_FROM", "test@example.test"); vi.stubEnv("APP_URL", "http://localhost:3000");
  userId = randomUUID(); users.push(userId);
  await db.insert(authUser).values({ id: userId, name: 'Synthetic personal CSV', email: `${userId}@example.test`, currency: "EUR" });
  await db.update(jobs).set({ status: "expired", notifiedAt: new Date() }).where(inArray(jobs.userId, users.filter(u => u !== userId)));
  vi.mocked(generateParser).mockReset().mockResolvedValue({ parser: { kind: "javascript", code }, model: "synthetic/model" }); send.mockClear();
});
afterAll(async () => {
  await db.delete(formats).where(inArray(formats.userId, users));
  await db.delete(transactions).where(inArray(transactions.userId, users));
  await db.delete(investmentTransactions).where(inArray(investmentTransactions.userId, users));
  await db.delete(instruments).where(inArray(instruments.createdByUserId, users));
  await db.delete(authUser).where(inArray(authUser.id, users));
  vi.unstubAllEnvs();
});
async function prepare(text = csv, formatId?: string) { const job = await enqueue(userId, { csv: text, name: "Synthetic Bank", formatId }); await processOne(); return job.id; }
const readJob = async (id: string) => (await db.select().from(jobs).where(eq(jobs.id, id)))[0];
const cash = () => db.select().from(transactions).where(eq(transactions.userId, userId));
describe("personal CSV durable flow", () => {
  it("creates an encrypted private job, previews without writes and atomically imports cash and investments once", async () => {
    const id = await prepare();
    expect((await readJob(id)).status).toBe("ready"); expect((await readJob(id)).encryptedCsv).toBeNull();
    expect(await cash()).toHaveLength(0); expect((await getPreview(userId, id)).records).toHaveLength(4);
    const results = await Promise.all([confirmImport(userId, id), confirmImport(userId, id)]);
    expect(results.map(r => r.inserted).sort()).toEqual([0, 3]);
    expect(await cash()).toHaveLength(3);
    expect((await db.select().from(accounts).where(eq(accounts.userId, userId)))[0].balance).toBe("895.00");
    expect(await db.select().from(investmentTransactions).where(eq(investmentTransactions.userId, userId))).toHaveLength(1);
    expect((await readJob(id)).encryptedPreview).toBeNull();
  });
  it("automatically saves a durable ready job once and emails only after completion", async () => {
    const id = await prepare();
    await db.update(jobs).set({ notifiedAt: new Date() }).where(inArray(jobs.userId, users.filter(u => u !== userId)));
    await maintainJobs();
    expect((await readJob(id)).status).toBe("imported");
    expect(await cash()).toHaveLength(3);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ subject: "Il tuo CSV è stato importato" }), expect.anything());
    await maintainJobs();
    expect(await cash()).toHaveLength(3);
    expect(send).toHaveBeenCalledTimes(1);
    expect(generateParser).toHaveBeenCalledTimes(1);
  });
  it("automatically rejects invalid history without partial financial writes", async () => {
    const id = await prepare(csv.replace(',BUY,', ',SELL,'));
    await maintainJobs();
    expect(await readJob(id)).toMatchObject({ status: "review_failed", error: expect.stringContaining("più quote") });
    expect(await cash()).toHaveLength(0);
    expect(await db.select().from(accounts).where(eq(accounts.userId, userId))).toHaveLength(0);
  });
  it("reuses a private parser without AI and detects duplicate rows even when row numbers change", async () => {
    const id = await prepare(); await confirmImport(userId, id);
    const formatId = (await readJob(id)).formatId;
    const next = await prepare(csv.replace('2024-01-01,CASH', '2023-12-31,NOTE,0,Metadata\n2024-01-01,CASH') + '\n2024-01-04,CASH,-2,New shop', formatId);
    expect(generateParser).toHaveBeenCalledTimes(1);
    expect(await confirmImport(userId, next)).toMatchObject({ inserted: 1, duplicates: 4 });
    expect(await cash()).toHaveLength(4);
  });
  it("denies another user list, preview, reuse and confirmation", async () => {
    const id = await prepare(), other = randomUUID(); users.push(other);
    await db.insert(authUser).values({ id: other, name: 'Other', email: `${other}@example.test` });
    expect((await listImports(other)).jobs).toHaveLength(0); expect(await getPreview(other, id)).toBeNull();
    await expect(confirmImport(other, id)).rejects.toThrow("non disponibile");
    await expect(enqueue(other, { csv, name: 'Other', formatId: (await readJob(id)).formatId })).rejects.toThrow("non disponibile");
  });
  it("rolls back account, portfolio, instrument and cash writes for an oversold history", async () => {
    const id = await prepare(csv.replace(',BUY,', ',SELL,'));
    await expect(confirmImport(userId, id)).rejects.toThrow("più quote");
    expect(await cash()).toHaveLength(0); expect(await db.select().from(accounts).where(eq(accounts.userId, userId))).toHaveLength(0);
    expect(await db.select().from(instruments).where(eq(instruments.createdByUserId, userId))).toHaveLength(0);
    expect(await db.select().from(investmentPortfolios).where(eq(investmentPortfolios.userId, userId))).toHaveLength(0);
  });
  it("keeps unknown rows visible and blocks partial imports", async () => {
    const id = await prepare(csv + '\n2024-01-04,ERROR,1,Unknown');
    expect((await readJob(id)).status).toBe("review_failed");
    expect((await getPreview(userId, id)).records.at(-1).outcome.kind).toBe("error");
    await expect(confirmImport(userId, id)).rejects.toThrow(); expect(await cash()).toHaveLength(0);
    expect(await db.select().from(parsers).where(eq(parsers.formatId, (await readJob(id)).formatId))).toHaveLength(0);
  });
  it("claims jobs once concurrently and recovers an expired lease", async () => {
    const { id } = await enqueue(userId, { csv, name: 'Lease bank' });
    const claims = await Promise.all([processOne(), processOne()]); expect(claims.filter(Boolean)).toHaveLength(1);
    expect((await readJob(id)).status).toBe("ready");
    const second = await enqueue(userId, { csv, name: 'Recovered bank' });
    await db.update(jobs).set({ status: "processing", lease: randomUUID(), leaseUntil: new Date(0) }).where(eq(jobs.id, second.id));
    await processOne(); expect((await readJob(second.id)).status).toBe("ready");
  });
  it("retries failed generation finitely and retries email separately", async () => {
    vi.mocked(generateParser).mockRejectedValue(new Error("private provider details"));
    const { id } = await enqueue(userId, { csv, name: 'Retry bank' });
    for (let i = 0; i < 3; i++) { await db.update(jobs).set({ availableAt: new Date(0) }).where(eq(jobs.id, id)); await processOne(); }
    expect((await readJob(id)).status).toBe("failed"); expect((await readJob(id)).attempts).toBe(3); expect((await readJob(id)).encryptedCsv).toBeNull(); expect((await readJob(id)).error).not.toContain("private");
    // Isolate this notification from jobs created by earlier cases.
    await db.update(jobs).set({ notifiedAt: new Date() }).where(inArray(jobs.userId, users.filter(u => u !== userId)));
    send.mockResolvedValueOnce({ error: { message: "unavailable" } }); await maintainJobs(); expect((await readJob(id)).notifiedAt).toBeNull();
    await db.update(jobs).set({ notifyAfter: new Date(0) }).where(eq(jobs.id, id)); await maintainJobs(); expect((await readJob(id)).notifiedAt).not.toBeNull(); expect(generateParser).toHaveBeenCalledTimes(3);
  });
  it("deletes only one upload, reverses its cash and allows reimport without affecting later uploads", async () => {
    const first = await prepare(); await confirmImport(userId, first);
    const formatId = (await readJob(first)).formatId;
    const second = await prepare(csv + '\n2024-01-04,CASH,-2,Later payment', formatId); await confirmImport(userId, second);
    const plan = await previewPersonalImportDeletion(userId, first);
    expect(plan).toMatchObject({ cashCount: 3, investmentCount: 1 });
    await expect(deletePersonalImport(randomUUID(), first, plan.token)).rejects.toThrow("non disponibile");
    await deletePersonalImport(userId, first, plan.token);
    expect(await readJob(first)).toBeUndefined(); expect((await readJob(second)).status).toBe("imported");
    expect(await cash()).toHaveLength(1);
    expect((await db.select().from(accounts).where(eq(accounts.userId, userId)))[0].balance).toBe("-2.00");
    expect(await db.select().from(parsers).where(eq(parsers.formatId, formatId))).toHaveLength(1);
    const reimport = await prepare(csv, formatId); expect(await confirmImport(userId, reimport)).toMatchObject({ inserted: 3 });
    expect(await cash()).toHaveLength(4);
  });
  it("deleting a duplicate-only upload leaves the original movements and receipts intact", async () => {
    const first = await prepare(); await confirmImport(userId, first); const formatId = (await readJob(first)).formatId;
    const duplicate = await prepare(csv, formatId); await confirmImport(userId, duplicate);
    const plan = await previewPersonalImportDeletion(userId, duplicate); expect(plan).toMatchObject({ cashCount: 0, investmentCount: 0 });
    await deletePersonalImport(userId, duplicate, plan.token); expect(await cash()).toHaveLength(3);
    const next = await prepare(csv, formatId); expect(await confirmImport(userId, next)).toMatchObject({ inserted: 0, duplicates: 4 });
  });
  it("rejects a stale confirmation and prevents deleting purchases needed by later sales", async () => {
    const first = await prepare(); await confirmImport(userId, first);
    const plan = await previewPersonalImportDeletion(userId, first); const [row] = await cash();
    await db.update(transactions).set({ description: "Edited after preview" }).where(eq(transactions.id, row.id));
    await expect(deletePersonalImport(userId, first, plan.token)).rejects.toThrow("cambiata"); expect(await cash()).toHaveLength(3);
    const sell = await prepare('Date,Type,Value,Description\n2024-01-05,SELL,1,Example shares', (await readJob(first)).formatId); await confirmImport(userId, sell);
    const current = await previewPersonalImportDeletion(userId, first);
    await expect(deletePersonalImport(userId, first, current.token)).rejects.toThrow("dipendono"); expect(await cash()).toHaveLength(4);
    await deletePersonalImport(userId, sell, (await previewPersonalImportDeletion(userId, sell)).token);
    await deletePersonalImport(userId, first, (await previewPersonalImportDeletion(userId, first)).token); expect(await cash()).toHaveLength(0);
  });
  it("removes a queued upload without deleting its reusable format", async () => {
    const { id } = await enqueue(userId, { csv, name: "Cancelled" }); const formatId = (await readJob(id)).formatId;
    const plan = await previewPersonalImportDeletion(userId, id); expect(plan.cashCount).toBe(0);
    await deletePersonalImport(userId, id, plan.token); expect(await readJob(id)).toBeUndefined();
    expect(await db.select().from(formats).where(eq(formats.id, formatId))).toHaveLength(1);
  });
  it("expires payloads, exports personal formats, and enforces queue limits", async () => {
    const id = await prepare(); expect((await exportPersonalImports(userId)).parsers).toHaveLength(1);
    await db.update(jobs).set({ expiresAt: new Date(0) }).where(eq(jobs.id, id));
    await maintainJobs(); expect((await readJob(id)).status).toBe("expired"); expect(await getPreview(userId, id)).toBeNull();
    await enqueue(userId, { csv, name: 'One' }); await enqueue(userId, { csv, name: 'Two' });
    await expect(enqueue(userId, { csv, name: 'Three' })).rejects.toThrow("Limite");
    await db.update(jobs).set({ status: "expired", encryptedCsv: null }).where(eq(jobs.userId, userId));
  });
});
