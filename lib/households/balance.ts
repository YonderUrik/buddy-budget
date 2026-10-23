/**
 * Who owes whom in a group. Every shared expense is split in equal parts among the people it was for (everyone in
 * the group unless chosen otherwise: some of them, or only someone else when it was paid entirely for them); a
 * settlement (a payment between two members) moves the balance the other way. Ids are group member ids, so people
 * without an account count like the others. Pure: the amounts come from `lib/households/data`.
 */

/** One expense shared with the group: who paid it, how much (positive) and who it was for (null = everyone). */
export interface SharedExpense {
  payerId: string;
  amount: number;
  forIds: readonly string[] | null;
}

/** A payment from one member to another that evened things out (also one step of the plan from `settleUp`). */
export interface Transfer {
  from: string;
  to: string;
  amount: number;
}

/** Below half a cent a balance is zero: equal parts of odd amounts leave fractions of a cent. */
const CENT_TOLERANCE = 0.005;

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * The people an expense is split among: those it was for who are still in the group, or everyone when it was for
 * everyone (or every one of them has left since).
 */
export function participantsOf(expense: Pick<SharedExpense, "forIds">, memberIds: readonly string[]): string[] {
  if (!expense.forIds) return [...memberIds];
  const left = expense.forIds.filter((id) => memberIds.includes(id));
  return left.length > 0 ? left : [...memberIds];
}

/** What one expense means for one member: positive = the others owe them for it, negative = they owe. */
export function expenseEffect(expense: SharedExpense, memberIds: readonly string[], memberId: string): number {
  if (!memberIds.includes(expense.payerId)) return 0;
  const people = participantsOf(expense, memberIds);
  const share = people.includes(memberId) ? expense.amount / people.length : 0;
  return round2((expense.payerId === memberId ? expense.amount : 0) - share);
}

/**
 * Balance of each member: positive = the others owe them, negative = they owe. A payer who is no longer a member is
 * ignored (their expenses left with them).
 */
export function computeBalances(memberIds: readonly string[], expenses: readonly SharedExpense[], settlements: readonly Transfer[]): Map<string, number> {
  const balances = new Map<string, number>(memberIds.map((id) => [id, 0]));
  if (memberIds.length < 2) return balances;
  for (const expense of expenses) {
    if (!balances.has(expense.payerId)) continue;
    const people = participantsOf(expense, memberIds);
    const share = expense.amount / people.length;
    for (const id of people) balances.set(id, balances.get(id)! - share);
    balances.set(expense.payerId, balances.get(expense.payerId)! + expense.amount);
  }
  for (const s of settlements) {
    if (!balances.has(s.from) || !balances.has(s.to)) continue;
    balances.set(s.from, balances.get(s.from)! + s.amount);
    balances.set(s.to, balances.get(s.to)! - s.amount);
  }
  for (const [id, value] of balances) balances.set(id, Math.abs(value) < CENT_TOLERANCE ? 0 : round2(value));
  return balances;
}

/**
 * The fewest payments that bring every balance to zero: the one who owes most pays the one owed most, until nobody
 * owes anything. With two people it is a single payment.
 */
export function settleUp(balances: ReadonlyMap<string, number>): Transfer[] {
  const debtors = [...balances].filter(([, v]) => v < -CENT_TOLERANCE).map(([id, v]) => ({ id, left: -v }));
  const creditors = [...balances].filter(([, v]) => v > CENT_TOLERANCE).map(([id, v]) => ({ id, left: v }));
  debtors.sort((a, b) => b.left - a.left || a.id.localeCompare(b.id));
  creditors.sort((a, b) => b.left - a.left || a.id.localeCompare(b.id));
  const transfers: Transfer[] = [];
  let d = 0;
  let c = 0;
  while (d < debtors.length && c < creditors.length) {
    const amount = Math.min(debtors[d].left, creditors[c].left);
    if (amount >= CENT_TOLERANCE) transfers.push({ from: debtors[d].id, to: creditors[c].id, amount: round2(amount) });
    debtors[d].left -= amount;
    creditors[c].left -= amount;
    if (debtors[d].left < CENT_TOLERANCE) d++;
    if (creditors[c].left < CENT_TOLERANCE) c++;
  }
  return transfers;
}

/** How an expense was split, for analytics: for everyone, some people, or only someone other than the payer. */
export function splitKind(forIds: readonly string[] | null, payerId: string): "all" | "some" | "other" {
  if (!forIds) return "all";
  return forIds.length === 1 && forIds[0] !== payerId ? "other" : "some";
}
