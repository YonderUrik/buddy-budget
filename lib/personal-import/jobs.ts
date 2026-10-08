import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { personalFormats as formats, personalParsers as parsers, personalImportJobs as jobs } from "@/lib/db/schema/personal-imports";
import { digest, seal, unseal } from "./crypto";
import { ImportError, readTable } from "./contract";
export const signatureOf = (table: ReturnType<typeof readTable>) => digest(JSON.stringify([table.delimiter, table.headers.map(h => h.trim())]));
export async function enqueue(userId: string, input: { csv: string; name: string; formatId?: string; regenerate?: boolean }) {
  const table = readTable(input.csv), signature = signatureOf(table);
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}), 81234)`);
    const recent = await tx.select({ status: jobs.status }).from(jobs).where(and(eq(jobs.userId, userId), gte(jobs.createdAt, new Date(Date.now() - 86400000))));
    if (recent.length >= 10 || recent.filter(j => ["queued", "processing"].includes(j.status)).length >= 2) throw new ImportError("Limite raggiunto: massimo 2 analisi in corso e 10 caricamenti al giorno");
    let format = input.formatId ? (await tx.select().from(formats).where(and(eq(formats.id, input.formatId), eq(formats.userId, userId))))[0] : undefined;
    if (input.formatId && !format) throw new ImportError("Formato non disponibile");
    if (!format) [format] = await tx.insert(formats).values({ userId, name: input.name }).returning();
    const [parser] = input.regenerate ? [] : await tx.select().from(parsers).where(and(eq(parsers.formatId, format.id), eq(parsers.signature, signature))).orderBy(desc(parsers.createdAt)).limit(1);
    const [job] = await tx.insert(jobs).values({ userId, formatId: format.id, parserId: parser?.id, encryptedCsv: seal(input.csv, userId), estimatedAt: new Date(Date.now() + 3600000), expiresAt: new Date(Date.now() + 7 * 86400000) }).returning({ id: jobs.id });
    return job;
  });
}
export async function listImports(userId: string) {
  const [sources, requests] = await Promise.all([
    db.select({ id: formats.id, name: formats.name }).from(formats).where(eq(formats.userId, userId)).orderBy(desc(formats.createdAt)),
    db.select({ id: jobs.id, formatId: jobs.formatId, status: jobs.status, estimatedAt: jobs.estimatedAt, expiresAt: jobs.expiresAt, createdAt: jobs.createdAt, error: jobs.error, notifiedAt: jobs.notifiedAt }).from(jobs).where(eq(jobs.userId, userId)).orderBy(desc(jobs.createdAt)),
  ]);
  return { formats: sources, jobs: requests };
}
export async function getPreview(userId: string, id: string) {
  const [job] = await db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.userId, userId)));
  if (!job || !job.encryptedPreview || job.expiresAt < new Date()) return null;
  return JSON.parse(unseal(job.encryptedPreview, userId));
}
