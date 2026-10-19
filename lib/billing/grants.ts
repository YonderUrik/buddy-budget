import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { billingAccessCodes, billingGrants, type BillingGrantSource } from "@/lib/db/schema/billing";
import { accessCodeRejection, generateAccessCode, hashAccessCode, type AccessCodeRejection } from "./access-codes";
import type { Entitlement } from "./entitlement";
import { recomputeEntitlement } from "./store";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface GrantInput {
  userId: string;
  source: BillingGrantSource;
  /** Null = Pro for good. */
  endsAt: Date | null;
  note?: string;
  accessCodeId?: string | null;
}

/** Gives free Pro to a user (whitelist, launch, code) and recomputes the access. */
export async function grantPro(input: GrantInput, now: Date = new Date()): Promise<Entitlement> {
  await db.insert(billingGrants).values({
    userId: input.userId,
    source: input.source,
    endsAt: input.endsAt,
    note: input.note ?? "",
    accessCodeId: input.accessCodeId ?? null,
    startsAt: now,
  });
  return recomputeEntitlement(input.userId, now);
}

/** Revokes every active grant of a user (a paid subscription is untouched) and recomputes the access. */
export async function revokeGrants(userId: string, now: Date = new Date()): Promise<{ revoked: number; entitlement: Entitlement }> {
  const rows = await db
    .update(billingGrants)
    .set({ revokedAt: now })
    .where(and(eq(billingGrants.userId, userId), isNull(billingGrants.revokedAt)))
    .returning({ id: billingGrants.id });
  return { revoked: rows.length, entitlement: await recomputeEntitlement(userId, now) };
}

export interface AccessCodeInput {
  label: string;
  /** Days of Pro from redemption; null = for good. */
  durationDays: number | null;
  maxRedemptions: number;
  expiresAt: Date | null;
}

/** Creates an access code and returns it in clear: this is the only time it can be read (only its hash is stored). */
export async function createAccessCode(input: AccessCodeInput): Promise<string> {
  const code = generateAccessCode();
  await db.insert(billingAccessCodes).values({
    codeHash: hashAccessCode(code),
    label: input.label,
    durationDays: input.durationDays,
    maxRedemptions: input.maxRedemptions,
    expiresAt: input.expiresAt,
  });
  return code;
}

export type RedeemResult = { ok: true; endsAt: Date | null; entitlement: Entitlement } | { ok: false; reason: AccessCodeRejection };

/**
 * Redeems a code for a user: checks it under a row lock (two people cannot take the last place), counts the redemption
 * and adds the grant in one transaction. The same user cannot redeem the same code twice.
 */
export async function redeemAccessCode(userId: string, raw: string, now: Date = new Date()): Promise<RedeemResult> {
  const outcome = await db.transaction(async (tx) => {
    const [code] = await tx
      .select()
      .from(billingAccessCodes)
      .where(eq(billingAccessCodes.codeHash, hashAccessCode(raw)))
      .for("update");
    const rejection = accessCodeRejection(code ?? null, now);
    if (rejection) return { ok: false as const, reason: rejection };
    const [previous] = await tx
      .select({ id: billingGrants.id })
      .from(billingGrants)
      .where(and(eq(billingGrants.userId, userId), eq(billingGrants.accessCodeId, code.id)));
    if (previous) return { ok: false as const, reason: "already_redeemed" as const };
    await tx
      .update(billingAccessCodes)
      .set({ redemptions: sql`${billingAccessCodes.redemptions} + 1` })
      .where(eq(billingAccessCodes.id, code.id));
    const endsAt = code.durationDays === null ? null : new Date(now.getTime() + code.durationDays * DAY_MS);
    await tx.insert(billingGrants).values({ userId, source: "code", accessCodeId: code.id, endsAt, startsAt: now });
    return { ok: true as const, endsAt };
  });
  if (!outcome.ok) return outcome;
  return { ...outcome, entitlement: await recomputeEntitlement(userId, now) };
}
