import "server-only";
import { and, eq, gt, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { personalFormats, personalImportJobs, personalParsers } from "@/lib/db/schema/personal-imports";
import { unseal } from "./crypto";
export async function exportPersonalImports(userId: string) {
  const formats = await db.select().from(personalFormats).where(eq(personalFormats.userId, userId));
  if (!formats.length) return { formats: [], parsers: [], jobs: [] };
  const [parsers, jobs] = await Promise.all([
    db.select().from(personalParsers).where(inArray(personalParsers.formatId, formats.map(f => f.id))),
    db.select().from(personalImportJobs).where(and(eq(personalImportJobs.userId, userId), gt(personalImportJobs.expiresAt, new Date()))),
  ]);
  return { formats, parsers: parsers.map(({ encryptedParser, ...p }) => ({ ...p, parser: JSON.parse(unseal(encryptedParser, userId)) })), jobs: jobs.map(({ encryptedCsv, encryptedPreview, lease: _lease, ...j }) => { void _lease; return { ...j, csv: encryptedCsv ? unseal(encryptedCsv, userId) : null, preview: encryptedPreview ? JSON.parse(unseal(encryptedPreview, userId)) : null }; }) };
}
