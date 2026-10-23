/**
 * Who owes whom in a group. Every shared expense is split in equal parts among the members; a settlement (a payment
 * between two members) moves the balance the other way. Pure: the amounts come from `lib/households/data`.
 */

/** One expense shared with the group: who paid it and how much (positive). */
export interface SharedExpense {
  payerId: string;
  amount: number;
}

/** A payment from one member to another that evened things out. */
export interface Settlement {
  fromUserId: string;
  toUserId: string;
  amount: number;
}

/** One payment of the plan that brings every balance to zero. */
export interface Transfer {
  fromUserId: string;
  toUserId: string;
  amount: number;
}

/** Below half a cent a balance is zero: equal parts of odd amounts leave fractions of a cent. */
const CENT_TOLERANCE = 0.005;

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Balance of each member: positive = the others owe them, negative = they owe. Expenses are shared among `memberIds`
 * in equal parts; a payer who is no longer a member is ignored (their expenses left with them).
 */
export function computeBalances(memberIds: readonly string[], expenses: readonly SharedExpense[], settlements: readonly Settlement[]): Map<string, number> {
  const balances = new Map<string, number>(memberIds.map((id) => [id, 0]));
  if (memberIds.length < 2) return balances;
  for (const expense of expenses) {
    if (!balances.has(expense.payerId)) continue;
    const share = expense.amount / memberIds.length;
    for (const id of memberIds) balances.set(id, balances.get(id)! - share);
    balances.set(expense.payerId, balances.get(expense.payerId)! + expense.amount);
  }
  for (const s of settlements) {
    if (!balances.has(s.fromUserId) || !balances.has(s.toUserId)) continue;
    balances.set(s.fromUserId, balances.get(s.fromUserId)! + s.amount);
    balances.set(s.toUserId, balances.get(s.toUserId)! - s.amount);
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
    if (amount >= CENT_TOLERANCE) transfers.push({ fromUserId: debtors[d].id, toUserId: creditors[c].id, amount: round2(amount) });
    debtors[d].left -= amount;
    creditors[c].left -= amount;
    if (debtors[d].left < CENT_TOLERANCE) d++;
    if (creditors[c].left < CENT_TOLERANCE) c++;
  }
  return transfers;
}
