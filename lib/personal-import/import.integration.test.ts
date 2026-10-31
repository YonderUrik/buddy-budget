import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { accounts } from "@/lib/db/schema/accounts";
import { transactions } from "@/lib/db/schema/transactions";
import { categories } from "@/lib/db/schema/categories";
import { categorizationRules } from "@/lib/db/schema/categorization-rules";
import { defaultCategoryRows } from "@/lib/categories/seed";
import { instruments, investmentTransactions, investmentPortfolios } from "@/lib/db/schema/investments";
import { personalFormats as formats, personalImportJobs as jobs, personalParsers as parsers } from "@/lib/db/schema/personal-imports";
import { ALREADY_IMPORTED_MESSAGE, enqueue, getPreview, listImports } from "./jobs";
import { ImportError } from "./contract";
import { deletePersonalImport, previewPersonalImportDeletion } from "./delete";
import { confirmImport } from "./confirm";
import { processOne, maintainJobs } from "./worker";
import { generateParser } from "./generate";
import { seal, unseal } from "./crypto";
import { importFormatProfiles } from "@/lib/db/schema/import-format-profiles";
import { saveFormatMetadata } from "@/lib/imports/store";
import { notifyImportSupport } from "./support-report";
import type { FormatMetadata } from "@/lib/imports";
import { exportPersonalImports } from "./export";
const send = vi.hoisted(() => vi.fn().mockResolvedValue({ data: { id: "synthetic" }, error: null }));
vi.mock("resend", () => ({ Resend: class { emails = { send }; } }));
vi.mock("./generate", async importOriginal => ({ ...await importOriginal<typeof import("./generate")>(), generateParser: vi.fn() }));
const code = `function(t){return t.rows.map((line,row)=>{const r=line[0].split(',');return r[0]==='Date'?{row,kind:'ignore',reason:'Header'}:r[1]==='ERROR'?{row,kind:'error',reason:'Unknown operation'}:r[1]==='NOTE'?{row,kind:'ignore',reason:'Metadata'}:r[1]==='CASH'?{row,kind:'cash',date:r[0],amount:Number(r[2]),description:r[3],currency:'EUR',transfer:false}:{row,kind:'investment',date:r[0],currency:'EUR',description:r[3],type:r[1]==='BUY'?'acquisto':'vendita',name:r[3],isin:null,instrumentType:'azione',quantity:Number(r[2]),price:100,grossAmount:null,fees:0,taxes:0}})}`;
const csv = 'Date,Type,Value,Description\n2024-01-01,CASH,1000,Deposit\n2024-01-02,BUY,1,Example shares\n2024-01-03,CASH,-5,Shop';
// The same movements in a different file (an extra note line): the exact same file is refused before any analysis.
const csvAgain = `${csv}\n2024-01-05,NOTE,0,Metadata`;
const metadata: FormatMetadata = { version: 1, institution: { name: "Synthetic Bank", evidence: "document" }, delimiter: ",", columns: [{ section: null, index: 0, name: "Date", mapsTo: ["date"] }, { section: null, index: 1, name: "Type", mapsTo: ["type"] }, { section: null, index: 2, name: "Value", mapsTo: ["amount", "quantity"] }, { section: null, index: 3, name: "Description", mapsTo: ["description", "name"] }] };
let userId: string; const users: string[] = [];
beforeEach(async () => {
  vi.stubEnv("PERSONAL_CSV_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
  vi.stubEnv("RESEND_API_KEY", "synthetic"); vi.stubEnv("RESEND_FROM", "test@example.test"); vi.stubEnv("APP_URL", "http://localhost:3000");
  userId = randomUUID(); users.push(userId);
  await db.insert(authUser).values({ id: userId, name: 'Synthetic personal CSV', email: `${userId}@example.test`, currency: "EUR" });
  await db.update(jobs).set({ status: "expired", notifiedAt: new Date(), supportNotifiedAt: new Date() }).where(inArray(jobs.userId, users.filter(u => u !== userId)));
  vi.mocked(generateParser).mockReset().mockResolvedValue({ parser: { kind: "javascript", code, metadata }, model: "synthetic/model" }); send.mockClear();
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
  it("reconciles Bitpanda cash and acquisition cost without double-counting inclusive fees", async () => {
    const csv = readFileSync(new URL("./fixtures/bitpanda-inclusive-fees.csv", import.meta.url), "utf8");
    const bitpandaCode = `function(t){return t.rows.map((r,row)=>{if(row<2)return {row,kind:'ignore',reason:'Header'};const c=r[0].split(',');const amount=Number(c[4]);if(c[2]==='deposit')return {row,kind:'cash',date:c[1].slice(0,10),currency:c[5],description:'Deposit',amount,transfer:true};const quantity=Number(c[6]),fees=Number(c[12]);return {row,kind:'investment',date:c[1].slice(0,10),currency:c[5],description:'Buy',type:'acquisto',name:'BTC',isin:null,instrumentType:'crypto',quantity,price:(amount-fees)/quantity,grossAmount:null,fees,taxes:0}})}`;
    vi.mocked(generateParser).mockResolvedValue({parser:{kind:"javascript",code:bitpandaCode.replace("(amount-fees)/quantity", "amount/quantity")},model:"synthetic/wrong-inclusive-fees"});
    const rejected = await prepare(csv);
    expect((await readJob(rejected)).status).toBe("failed");
    expect(generateParser).toHaveBeenCalledTimes(3);
    expect(await cash()).toHaveLength(0);
    vi.mocked(generateParser).mockResolvedValue({parser:{kind:"javascript",code:bitpandaCode},model:"synthetic/correct-inclusive-fees"});
    const id = await prepare(csv);
    const validPreview = (await readJob(id)).encryptedPreview!;
    const stale = JSON.parse(unseal(validPreview,userId));
    stale.records.find((r: {outcome: {kind: string}}) => r.outcome.kind === "investment").outcome.price = 40000;
    await db.update(jobs).set({encryptedPreview:seal(JSON.stringify(stale),userId)}).where(eq(jobs.id,id));
    await expect(confirmImport(userId,id)).rejects.toThrow("non riconcilia");
    expect(await cash()).toHaveLength(0);
    await db.update(jobs).set({encryptedPreview:validPreview}).where(eq(jobs.id,id));
    await maintainJobs();
    expect((await readJob(id)).status).toBe("imported");
    expect((await db.select().from(accounts).where(eq(accounts.userId,userId)))[0].balance).toBe("100.00");
    const [trade] = await db.select().from(investmentTransactions).where(eq(investmentTransactions.userId,userId));
    expect(Number(trade.quantity)).toBe(0.005);
    expect(trade.fees).toBe("1.99");
    expect(Number(trade.quantity)*Number(trade.price)+Number(trade.fees)).toBeCloseTo(200,2);
  });
  it("rejects AI decimal scaling errors before creating movements or saving the parser", async () => {
    const directMetadata: FormatMetadata = { ...metadata, columns: [{ section: null, index: 2, name: "Amount", mapsTo: ["amount"] }] };
    vi.mocked(generateParser).mockResolvedValue({ parser: { kind: "javascript", code: code.replace("amount:Number(r[2])", "amount:Number(r[2])*100"), metadata: directMetadata }, model: "synthetic/scaling-error" });
    const id = await prepare(csv.replace("Date,Type,Value,Description", "Date,Type,Amount,Description"));
    expect((await readJob(id)).status).toBe("failed");
    expect(await cash()).toHaveLength(0);
    expect(await db.select().from(parsers).where(eq(parsers.formatId, (await readJob(id)).formatId))).toHaveLength(0);
  });
  it("persists institution and fields independently of deleted raw payloads and groups layouts per owner", async () => {
    const id = await prepare();
    await confirmImport(userId, id);
    const [profile] = await db.select().from(importFormatProfiles).where(eq(importFormatProfiles.userId, userId));
    const data = JSON.parse(profile.metadata);
    expect(data.institution).toEqual(metadata.institution);
    expect(data.columns).toEqual(metadata.columns);
    expect(data.parsedFields).toEqual(expect.arrayContaining(["date", "amount", "quantity"]));
    expect(profile.metadata).not.toMatch(/Deposit|Example shares|Shop/);
    await saveFormatMetadata(userId, "ai", metadata, [
      {date:"2024-01-01",currency:"EUR",description:"private",amount:1000,transfer:false},
      {date:"2024-01-01",currency:"EUR",description:"private",type:"acquisto",name:"private",isin:null,instrumentType:"azione",quantity:1,price:100,grossAmount:null,fees:0,taxes:0}
    ]);
    const profiles = await db.select().from(importFormatProfiles).where(eq(importFormatProfiles.userId, userId));
    expect(profiles).toHaveLength(1); expect(profiles[0].observations).toBe(2);
    expect((await readJob(id)).encryptedPreview).toBeNull();
  });
  it("automatically replaces a broken saved parser and reports success to support without duplicate writes", async () => {
    const first = await prepare(); await confirmImport(userId, first);
    const old = await readJob(first);
    await db.update(parsers).set({ encryptedParser: seal(JSON.stringify({kind:"javascript",code:"function(){throw Error('private text')}"}), userId) }).where(eq(parsers.id, old.parserId!));
    const second = await prepare(csvAgain, old.formatId);
    const job = await readJob(second);
    expect(job.status).toBe("ready"); expect(job.parserId).not.toBe(old.parserId);
    expect(job.failureReport).toMatchObject({ fallback:true, reason:"invalid_parser", attempts: [{ step: 0, reason: "invalid_parser" }] });
    await maintainJobs(); await maintainJobs();
    expect((await readJob(second)).status).toBe("imported"); expect(await cash()).toHaveLength(3);
    expect(generateParser).toHaveBeenCalledTimes(2);
    const reports = send.mock.calls.filter(call => call[0].subject.startsWith("Importazione: report"));
    expect(reports).toHaveLength(1); expect(reports[0][0].to).toBe("support@buddybudget.io");
    expect(reports[0][0].text).not.toContain("private text");
    await maintainJobs(); expect(send.mock.calls.filter(call => call[0].subject.startsWith("Importazione: report"))).toHaveLength(1);
  });
  it("does not send a reused file to AI under the previous consent wording", async () => {
    const first = await prepare(); const original = await readJob(first);
    await db.update(parsers).set({encryptedParser:seal(JSON.stringify({kind:"javascript",code:"function(){throw Error('broken')}"}),userId)}).where(eq(parsers.id,original.parserId!));
    const next = await enqueue(userId,{csv,name:"Legacy",formatId:original.formatId});
    await db.update(jobs).set({consentVersion:"openrouter-raw-zdr-v2"}).where(eq(jobs.id,next.id));
    await processOne();
    expect(generateParser).toHaveBeenCalledTimes(1);
    expect((await readJob(next.id)).status).toBe("failed");
    expect((await readJob(next.id)).error).toContain("autorizzare");
  });
  it("retries support delivery independently without running AI again", async () => {
    const id = await prepare(csv + "\n2024-01-04,ERROR,1,Unknown");
    send.mockResolvedValueOnce({error:{message:"unavailable"}});
    await notifyImportSupport(); expect((await readJob(id)).supportNotifiedAt).toBeNull();
    await db.update(jobs).set({supportNotifyAfter:new Date(0)}).where(eq(jobs.id,id));
    await notifyImportSupport(); expect((await readJob(id)).supportNotifiedAt).not.toBeNull();
    expect(generateParser).toHaveBeenCalledTimes(3);
  });
  it("deduplicates broker fallback requests and preserves the original failure report", async () => {
    const one = await enqueue(userId, {csv, name:"ignored", brokerFallback:true});
    const two = await enqueue(userId, {csv, name:"ignored", brokerFallback:true});
    expect(two.id).toBe(one.id);
    await processOne(); await maintainJobs(); await maintainJobs();
    expect((await readJob(one.id)).failureReport).toMatchObject({reason:"broker_parse_failed",fallback:true});
    expect((await readJob(one.id)).status).toBe("imported");
    expect(generateParser).toHaveBeenCalledTimes(1);
  });

  it("creates an encrypted private job, previews without writes and atomically imports cash and investments once", async () => {
    const id = await prepare();
    expect((await readJob(id)).status).toBe("ready"); expect((await readJob(id)).encryptedCsv).toBeNull();
    expect(await cash()).toHaveLength(0); expect((await getPreview(userId, id))!.records).toHaveLength(4);
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
    expect(await readJob(id)).toMatchObject({ status: "failed", error: expect.stringContaining("più quote"), failureReport: expect.objectContaining({ reason: "financial_validation_failed" }) });
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
  it("never imports part of a file: unknown rows after every step fail the job with one message", async () => {
    const id = await prepare(csv + '\n2024-01-04,ERROR,1,Unknown');
    const job = await readJob(id);
    expect(job).toMatchObject({ status: "failed", encryptedCsv: null, encryptedPreview: null });
    expect(job.error).toContain("Non siamo riusciti a leggere questo file");
    expect(job.failureReport).toMatchObject({ reason: "ladder_exhausted" });
    expect(job.failureReport!.attempts!.map(a => [a.step, a.reason])).toEqual([[1, "unrecognized_rows"], [2, "unrecognized_rows"], [3, "unrecognized_rows"]]);
    expect(generateParser).toHaveBeenCalledTimes(3);
    expect(await cash()).toHaveLength(0);
    expect(await db.select().from(parsers).where(eq(parsers.formatId, job.formatId))).toHaveLength(0);
  });
  it("climbs the ladder with the failing lines and saves the parser of the step that reads every row", async () => {
    vi.mocked(generateParser).mockResolvedValueOnce({ parser: { kind: "javascript", code, metadata }, model: "synthetic/model" })
      .mockResolvedValueOnce({ parser: { kind: "javascript", code: code.replace("'ERROR'", "'NEVER'").replace("r[1]==='CASH'", "r[1]==='CASH'||r[1]==='ERROR'"), metadata }, model: "synthetic/model" });
    const id = await prepare(csv + '\n2024-01-04,ERROR,1,Unknown');
    expect((await readJob(id)).status).toBe("ready");
    const second = vi.mocked(generateParser).mock.calls[1][1].request;
    expect(second).toMatchObject({ step: 2, reasoning: false, maxTokens: 32768 });
    expect(second.feedback[0].lines).toEqual([{ row: 4, text: "2024-01-04,ERROR,1,Unknown" }]);
    expect(await db.select().from(parsers).where(eq(parsers.formatId, (await readJob(id)).formatId))).toHaveLength(1);
    await maintainJobs();
    expect(await cash()).toHaveLength(4);
  });
  it("after a layout change, skips the movements already imported by their exact content", async () => {
    const first = await prepare(); await confirmImport(userId, first);
    const formatId = (await readJob(first)).formatId;
    // The bank adds a Balance column: every raw line changes and the saved parser leaves it undeclared.
    const widened = csv.split("\n").map((line, i) => `${line},${i === 0 ? "Balance" : "0"}`).join("\n") + "\n2024-01-04,CASH,-2,New shop,0";
    vi.mocked(generateParser).mockResolvedValue({ parser: { kind: "javascript", code, metadata: { ...metadata, columns: [...metadata.columns, { section: null, index: 4, name: "Balance", mapsTo: [] }] } }, model: "synthetic/model-v2" });
    const next = await prepare(widened, formatId);
    expect((await readJob(next)).failureReport!.attempts).toEqual([expect.objectContaining({ step: 0, reason: "undeclared_columns" })]);
    expect(vi.mocked(generateParser).mock.calls.at(-1)![1].request.reference?.parser).toMatchObject({ kind: "javascript" });
    expect(await confirmImport(userId, next)).toMatchObject({ inserted: 1, rows: 4, alreadyPresent: 3 });
    expect(await cash()).toHaveLength(4);
    expect(await db.select().from(investmentTransactions).where(eq(investmentTransactions.userId, userId))).toHaveLength(1);
  });
  it("a line already imported but read differently by a new parser counts as present, not as a block", async () => {
    const first = await prepare(); await confirmImport(userId, first);
    const formatId = (await readJob(first)).formatId;
    vi.mocked(generateParser).mockResolvedValue({ parser: { kind: "javascript", code: code.replace("description:r[3]", "description:r[3]+' (v2)'"), metadata }, model: "synthetic/model-v2" });
    const next = (await enqueue(userId, { csv: csvAgain, name: "Synthetic Bank", formatId, regenerate: true })).id; await processOne();
    expect(await confirmImport(userId, next)).toMatchObject({ inserted: 0, alreadyPresent: 3 });
    expect(await cash()).toHaveLength(3);
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
    send.mockImplementationOnce(async (message) => message.to === `${userId}@example.test` ? { error: { message: "unavailable" } } : { error: null });
    await notifyImportSupport();
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
  describe("files with movements already imported", () => {
    it("refuses the exact same file before any analysis, whatever source is chosen", async () => {
      const first = await prepare(); await confirmImport(userId, first);
      const formatId = (await readJob(first)).formatId;
      for (const input of [{ csv, name: "Synthetic Bank" }, { csv: `\uFEFF${csv.replaceAll("\n", "\r\n")}\r\n`, name: "Another name" }, { csv, name: "Synthetic Bank", formatId }]) {
        const error = await enqueue(userId, input).catch(e => e);
        expect(error).toBeInstanceOf(ImportError); expect(error).toMatchObject({ code: "already_imported", message: ALREADY_IMPORTED_MESSAGE });
      }
      expect((await listImports(userId)).jobs).toHaveLength(1);
      expect(generateParser).toHaveBeenCalledTimes(1);
      expect(await cash()).toHaveLength(3);
    });
    it("adds nothing from a different file whose movements are all there, and says so", async () => {
      const first = await prepare(); await confirmImport(userId, first);
      const again = await prepare(csvAgain);
      expect(await confirmImport(userId, again)).toMatchObject({ inserted: 0, rows: 3, alreadyPresent: 3 });
      expect(await cash()).toHaveLength(3);
      expect(await db.select().from(accounts).where(eq(accounts.userId, userId))).toHaveLength(1);
      expect((await listImports(userId)).jobs.find(j => j.id === again)?.results).toMatchObject({ cash: 0, investments: 0, rows: 3, alreadyPresent: 3 });
    });
    it("imports only the new movements of an overlapping file, into the same account, even as a new source", async () => {
      const first = await prepare(); await confirmImport(userId, first);
      const overlapping = 'Date,Type,Value,Description\n2024-01-03,CASH,-5,Shop\n2024-01-04,CASH,-7,Bakery\n2024-01-05,CASH,-2,Kiosk';
      const next = await prepare(overlapping);
      expect((await readJob(next)).formatId).not.toBe((await readJob(first)).formatId);
      expect(await confirmImport(userId, next)).toMatchObject({ inserted: 2, rows: 3, alreadyPresent: 1 });
      const rows = await cash();
      expect(rows).toHaveLength(5); expect(new Set(rows.map(r => r.accountId)).size).toBe(1);
      expect((await db.select().from(accounts).where(eq(accounts.userId, userId)))[0].balance).toBe("886.00");
      expect((await listImports(userId)).jobs.find(j => j.id === next)?.results).toMatchObject({ cash: 2, rows: 3, alreadyPresent: 1 });
      // Deleting the first import makes its rows new again for the second source.
      await deletePersonalImport(userId, first, (await previewPersonalImportDeletion(userId, first)).token);
      const replay = await prepare(csvAgain, (await readJob(next)).formatId);
      expect(await confirmImport(userId, replay)).toMatchObject({ inserted: 3, rows: 3, alreadyPresent: 0 });
    });
  });
  it("deleting a duplicate-only upload leaves the original movements and receipts intact", async () => {
    const first = await prepare(); await confirmImport(userId, first); const formatId = (await readJob(first)).formatId;
    const duplicate = await prepare(csvAgain, formatId); await confirmImport(userId, duplicate);
    const plan = await previewPersonalImportDeletion(userId, duplicate); expect(plan).toMatchObject({ cashCount: 0, investmentCount: 0 });
    await deletePersonalImport(userId, duplicate, plan.token); expect(await cash()).toHaveLength(3);
    const next = await prepare(csvAgain, formatId); expect(await confirmImport(userId, next)).toMatchObject({ inserted: 0, duplicates: 4 });
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
  describe("bank categories", () => {
    // Semicolon bank export with the bank's own category; the parser ignores that column, so the importer reads it.
    const bankCsv = 'Data;Descrizione;Categoria;Importo\n2024-02-01;PAGAMENTO POS PIZZERIA DA MARIO;Ristorazione;-20\n2024-02-02;ESSELUNGA MILANO;Supermercati;-40\n2024-02-03;BONIFICO VARIO;Altro;-5\n2024-02-04;STIPENDIO ACME;Stipendio;1500';
    const bankCode = (withCategory: boolean) => `function(t){return t.rows.map((line,row)=>{const r=line[0].split(';');return row===0?{row,kind:'ignore',reason:'Header'}:{row,kind:'cash',date:r[0],amount:Number(r[3]),description:r[1],currency:'EUR',transfer:false${withCategory ? ",bankCategory:r[2]" : ""}}})}`;
    const categoryOf = async (description: string) => {
      const rows = await db.select().from(transactions).where(eq(transactions.userId, userId));
      const row = rows.find(r => r.rawDescription === description)!;
      const [category] = await db.select().from(categories).where(eq(categories.id, row.categoryId));
      return { ...row, defaultKey: category.defaultKey, isFallback: category.isFallback };
    };
    beforeEach(async () => {
      await db.insert(categories).values(defaultCategoryRows(userId));
      vi.mocked(generateParser).mockResolvedValue({ parser: { kind: "javascript", code: bankCode(false) }, model: "synthetic/bank" });
    });

    it("applies the bank's category without asking, except where a user rule decides, and keeps the label", async () => {
      const [svago] = await db.select().from(categories).where(and(eq(categories.userId, userId), eq(categories.defaultKey, "svago")));
      await db.insert(categorizationRules).values({ userId, matchType: "contains", pattern: "esselunga", categoryId: svago.id, source: "manuale" });
      const id = await prepare(bankCsv);
      const result = await confirmImport(userId, id);
      expect(result).toMatchObject({ inserted: 4, bankCategorized: 2 });
      expect(await categoryOf("PAGAMENTO POS PIZZERIA DA MARIO")).toMatchObject({ defaultKey: "ristoranti", categorySource: "banca", bankCategory: "Ristorazione" });
      expect(await categoryOf("STIPENDIO ACME")).toMatchObject({ defaultKey: "stipendio", categorySource: "banca" });
      // The rule takes Esselunga after the import; the generic «Altro» goes through the usual flow.
      expect(await categoryOf("ESSELUNGA MILANO")).toMatchObject({ isFallback: true, bankCategory: "Supermercati" });
      expect(await categoryOf("BONIFICO VARIO")).toMatchObject({ isFallback: true, categorySource: null, bankCategory: "Altro" });
      expect((await listImports(userId)).jobs.find(j => j.id === id)!.results).toMatchObject({ bankCategorized: 2 });
    });

    it("follows the user's corrections on later imports", async () => {
      await confirmImport(userId, await prepare(bankCsv));
      const [svago] = await db.select().from(categories).where(and(eq(categories.userId, userId), eq(categories.defaultKey, "svago")));
      const pizzeria = await categoryOf("PAGAMENTO POS PIZZERIA DA MARIO");
      await db.update(transactions).set({ categoryId: svago.id, categorySource: "utente" }).where(eq(transactions.id, pizzeria.id));
      await confirmImport(userId, await prepare(bankCsv.replace("2024-02-04;STIPENDIO ACME;Stipendio;1500", "2024-02-05;OSTERIA;Ristorazione;-30")));
      expect(await categoryOf("OSTERIA")).toMatchObject({ defaultKey: "ristoranti", categorySource: "banca" });
      await db.update(transactions).set({ categoryId: svago.id, categorySource: "utente" }).where(eq(transactions.id, (await categoryOf("OSTERIA")).id));
      await confirmImport(userId, await prepare(bankCsv.replace("2024-02-04;STIPENDIO ACME;Stipendio;1500", "2024-02-06;TRATTORIA;Ristorazione;-35")));
      expect(await categoryOf("TRATTORIA")).toMatchObject({ defaultKey: "svago", categorySource: "banca" });
    });

    it("re-importing rows imported before the bank category was read finds duplicates, not new interpretations", async () => {
      const first = await prepare(bankCsv);
      const stored = JSON.parse(unseal((await readJob(first)).encryptedPreview!, userId));
      for (const record of stored.records) delete record.outcome.bankCategory;
      await db.update(jobs).set({ encryptedPreview: seal(JSON.stringify(stored), userId) }).where(eq(jobs.id, first));
      await confirmImport(userId, first);
      vi.mocked(generateParser).mockResolvedValue({ parser: { kind: "javascript", code: bankCode(true) }, model: "synthetic/bank-v2" });
      const second = (await enqueue(userId, { csv: bankCsv, name: "Synthetic Bank", formatId: (await readJob(first)).formatId, regenerate: true })).id;
      await processOne();
      expect(await confirmImport(userId, second)).toMatchObject({ inserted: 0, duplicates: 5 });
    });
  });
});
