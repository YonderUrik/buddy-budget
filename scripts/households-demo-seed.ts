/**
 * Sample people for the group screens («Gruppi»), on top of `pnpm demo:seed` (Giulia Demo). Dev and screenshot use
 * only: refuses to run on a database with users other than the demo ones.
 *
 *   pnpm tsx scripts/households-demo-seed.ts people   # Marco, Sara, Luca with accounts, transactions and sessions
 *   pnpm tsx scripts/households-demo-seed.ts groups   # the rest of the story once «Noi due» exists (created in the UI)
 *
 * Sessions: `<name>-session-token-000…` signed with BETTER_AUTH_SECRET, like the capture script does for the demo.
 */

import { and, eq, inArray } from "drizzle-orm";
import { client, db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { authSession, authUser } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";
import { householdAccounts, householdMembers, households, householdSplitRules, householdSplits } from "@/lib/db/schema/households";
import { transactions } from "@/lib/db/schema/transactions";
import { defaultCategoryRows } from "@/lib/categories/seed";
import { LEGAL_VERSION } from "@/lib/legal";

const DEMO_USER_ID = "demo-user";
const PEOPLE = [
  { id: "demo-marco", name: "Marco Bianchi", email: "marco.demo@example.com" },
  { id: "demo-sara", name: "Sara Conti", email: "sara.demo@example.com" },
  { id: "demo-luca", name: "Luca Ferri", email: "luca.demo@example.com" },
] as const;

export const sessionToken = (id: string) => `${id.replace("demo-", "")}-session-token-000000000000000`;

const today = new Date();
const ym = today.toISOString().slice(0, 7);
const day = (d: number) => `${ym}-${String(Math.min(d, today.getUTCDate())).padStart(2, "0")}`;

async function categoryIds(userId: string) {
  const rows = await db.select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.userId, userId));
  return (name: string) => {
    const found = rows.find((r) => r.name === name);
    if (!found) throw new Error(`Missing category ${name}`);
    return found.id;
  };
}

async function people() {
  const users = await db.select({ id: authUser.id }).from(authUser);
  const allowed = new Set<string>([DEMO_USER_ID, ...PEOPLE.map((p) => p.id)]);
  if (users.some((u) => !allowed.has(u.id))) throw new Error("Other users in the database: this seed only runs on the demo database.");
  await db.delete(households);
  await db.delete(authUser).where(inArray(authUser.id, PEOPLE.map((p) => p.id)));
  for (const p of PEOPLE) {
    await db.insert(authUser).values({
      id: p.id,
      name: p.name,
      email: p.email,
      emailVerified: true,
      currency: "EUR",
      productCountry: "IT",
      language: "it",
      onboardingCompleted: true,
      legalAcceptedAt: new Date(),
      legalAcceptedVersion: LEGAL_VERSION,
    });
    await db.insert(authSession).values({ id: `${p.id}-session`, userId: p.id, token: sessionToken(p.id), expiresAt: new Date(Date.now() + 7 * 86400000) });
    await db.insert(categories).values(defaultCategoryRows(p.id));
  }

  // Marco: the house account (rent and bills go out from there) and his own current account.
  const marco = PEOPLE[0].id;
  const cat = await categoryIds(marco);
  const [casa, corrente, deposito] = await db
    .insert(accounts)
    .values([
      { userId: marco, name: "Conto Casa", type: "Conto corrente", balance: "2310.00", icon: "home", color: "amber" },
      { userId: marco, name: "Conto corrente", type: "Conto corrente", balance: "6840.20", icon: "landmark", color: "blue" },
      { userId: marco, name: "Conto deposito", type: "Conto deposito", balance: "28000.00", icon: "piggy-bank", color: "emerald" },
    ])
    .returning();
  const tx = (accountId: string, date: string, description: string, amount: number, category: string) => ({
    userId: marco,
    accountId,
    date,
    description,
    amount: amount.toFixed(2),
    categoryId: cat(category),
  });
  await db.insert(transactions).values([
    tx(casa.id, day(1), "Affitto box auto", -120, "Affitto & Mutuo"),
    tx(casa.id, day(3), "Coop", -86.4, "Spesa"),
    tx(casa.id, day(6), "A2A Energia", -64.1, "Bollette & Telefono"),
    tx(casa.id, day(9), "Coop", -112.3, "Spesa"),
    tx(casa.id, day(12), "Fastweb", -29.95, "Bollette & Telefono"),
    tx(casa.id, day(15), "Leroy Merlin", -73.5, "Casa & Arredamento"),
    tx(casa.id, day(18), "Coop", -94.8, "Spesa"),
    tx(casa.id, day(2), "Versamento Giulia", 400, "Altre entrate"),
    tx(casa.id, day(2), "Versamento Marco", 400, "Altre entrate"),
    tx(corrente.id, day(1), "Stipendio", 2150, "Stipendio"),
    tx(corrente.id, day(4), "Pizzeria Da Gennaro", -46, "Ristoranti & Bar"),
    tx(corrente.id, day(8), "Cinema Odeon", -19, "Svago"),
    tx(corrente.id, day(11), "Ikea", -149, "Casa & Arredamento"),
    tx(corrente.id, day(14), "Sushi Zen", -58.6, "Ristoranti & Bar"),
    tx(corrente.id, day(16), "Decathlon", -42.9, "Sport & Benessere"),
    tx(corrente.id, day(19), "Esselunga", -37.2, "Spesa"),
  ]);
  void deposito;

  // Sara and Luca: one account each, the trip's expenses.
  for (const [p, rows] of [
    [PEOPLE[1].id, [["Traghetto Moby", -312, "Viaggi", 3], ["Agriturismo Su Barchile", -420, "Viaggi", 7]]],
    [PEOPLE[2].id, [["Noleggio auto Olbia", -186, "Viaggi", 5], ["Ristorante Sa Mesa", -96, "Ristoranti & Bar", 8]]],
  ] as const) {
    const c = await categoryIds(p);
    const [acc] = await db.insert(accounts).values({ userId: p, name: "Conto corrente", type: "Conto corrente", balance: "3200.00", icon: "landmark", color: "teal" }).returning();
    await db.insert(transactions).values(rows.map(([description, amount, category, d]) => ({ userId: p, accountId: acc.id, date: day(d), description, amount: amount.toFixed(2), categoryId: c(category) })));
  }
  console.log("People ready: Marco, Sara, Luca.");
}

/** After «Noi due» exists (made in the UI): expenses marked in common, Giulia's rule, the trip group. */
async function groups() {
  const [noiDue] = await db
    .select({ id: householdMembers.householdId })
    .from(householdMembers)
    .where(eq(householdMembers.userId, PEOPLE[0].id));
  if (!noiDue) throw new Error("Create «Noi due» in the app first (Giulia invites Marco, Marco accepts).");
  const marco = PEOPLE[0].id;
  const pick = async (userId: string, descriptions: string[]) => {
    const rows = await db.select({ id: transactions.id, description: transactions.description, date: transactions.date }).from(transactions).where(eq(transactions.userId, userId));
    return rows.filter((r) => descriptions.includes(r.description) && r.date >= `${ym}-01`);
  };
  // Giulia: Enel and the restaurant by hand, Esselunga by a rule from the start of the month.
  for (const r of await pick(DEMO_USER_ID, ["Enel Energia", "Trattoria da Mario"])) {
    await db.insert(householdSplits).values({ transactionId: r.id, userId: DEMO_USER_ID, householdId: noiDue.id }).onConflictDoNothing();
  }
  await db.delete(householdSplitRules).where(eq(householdSplitRules.userId, DEMO_USER_ID));
  await db.insert(householdSplitRules).values({ userId: DEMO_USER_ID, householdId: noiDue.id, merchantKey: "esselunga", fromDate: `${ym}-01` });
  // Marco: dinners, the cinema, Ikea.
  for (const r of await pick(marco, ["Pizzeria Da Gennaro", "Cinema Odeon", "Ikea", "Sushi Zen"])) {
    await db.insert(householdSplits).values({ transactionId: r.id, userId: marco, householdId: noiDue.id }).onConflictDoNothing();
  }

  // The trip: Giulia, Sara, Luca. Giulia shares nothing but the expenses; Sara shows her net worth, Luca does not.
  await db.delete(households).where(and(eq(households.createdBy, PEOPLE[1].id)));
  const [trip] = await db.insert(households).values({ name: "Vacanza in Sardegna", createdBy: PEOPLE[1].id }).returning();
  const base = Date.now() - 3 * 86400000;
  await db.insert(householdMembers).values([
    { householdId: trip.id, userId: PEOPLE[1].id, joinedAt: new Date(base) },
    { householdId: trip.id, userId: DEMO_USER_ID, joinedAt: new Date(base + 60000) },
    { householdId: trip.id, userId: PEOPLE[2].id, joinedAt: new Date(base + 120000) },
  ]);
  for (const p of [PEOPLE[1].id, PEOPLE[2].id]) {
    const rows = await db.select({ id: transactions.id }).from(transactions).where(eq(transactions.userId, p));
    await db.insert(householdSplits).values(rows.map((r) => ({ transactionId: r.id, userId: p, householdId: trip.id })));
  }
  // Giulia paid the ferry for herself? No: she paid the first dinner and the fuel.
  const c = await categoryIds(DEMO_USER_ID);
  const [giuliaCorrente] = await db.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.userId, DEMO_USER_ID), eq(accounts.name, "Conto corrente")));
  const added = await db
    .insert(transactions)
    .values([
      { userId: DEMO_USER_ID, accountId: giuliaCorrente.id, date: day(6), description: "Spesa Conad Palau", amount: "-88.40", categoryId: c("Spesa") },
      { userId: DEMO_USER_ID, accountId: giuliaCorrente.id, date: day(7), description: "Q8 Olbia", amount: "-71.00", categoryId: c("Trasporti") },
    ])
    .returning({ id: transactions.id });
  await db.insert(householdSplits).values(added.map((r) => ({ transactionId: r.id, userId: DEMO_USER_ID, householdId: trip.id })));
  await db.update(householdMembers).set({ sharesNetWorth: true }).where(and(eq(householdMembers.householdId, trip.id), eq(householdMembers.userId, PEOPLE[1].id)));
  void householdAccounts;
  console.log("Groups ready: «Noi due» with expenses in common, «Vacanza in Sardegna».");
}

const phase = process.argv[2];
(phase === "people" ? people() : phase === "groups" ? groups() : Promise.reject(new Error("Use: people | groups")))
  .then(async () => {
    await client.end();
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
