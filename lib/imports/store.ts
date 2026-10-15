import "server-only";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { importFormatProfiles } from "@/lib/db/schema/import-format-profiles";
import { formatMetadataSchema, metadataIdentity, observedFields, type FormatMetadata } from "./metadata";

/** Merge repeated observations per owner, engine and layout without promoting private parsers to a shared catalog. */
export async function saveFormatMetadata(userId: string, engine: "ai" | "native" | "mapping", metadata: FormatMetadata, rows: readonly object[]) {
  const validated = formatMetadataSchema.parse(metadata);
  const parsedFields = observedFields(rows);
  const fingerprint = createHash("sha256").update(metadataIdentity(validated, parsedFields)).digest("hex");
  await db.insert(importFormatProfiles).values({ userId, engine, fingerprint, metadata: JSON.stringify({ ...validated, parsedFields }) }).onConflictDoUpdate({
    target: [importFormatProfiles.userId, importFormatProfiles.engine, importFormatProfiles.fingerprint],
    set: { observations: sql`${importFormatProfiles.observations} + 1`, lastSeenAt: new Date() },
  });
}
