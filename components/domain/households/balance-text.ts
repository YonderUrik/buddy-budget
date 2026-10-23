import type { Transfer } from "@/lib/households/balance";
import type { HouseholdPerson } from "@/lib/households/types";

type Tr = (text: string, values?: Record<string, string | number>) => string;

/** «Giulia dà a te 64,20 €», «Tu dai a Giulia …», «Marco dà a Sara …». */
export function transferLine(t: Transfer, members: readonly HouseholdPerson[], money: (n: number) => string, tr: Tr): string {
  const from = members.find((m) => m.userId === t.fromUserId);
  const to = members.find((m) => m.userId === t.toUserId);
  if (from?.isMe) return tr("Tu dai a {0} {1}", { 0: to?.name ?? "", 1: money(t.amount) });
  if (to?.isMe) return tr("{0} dà a te {1}", { 0: from?.name ?? "", 1: money(t.amount) });
  return tr("{0} dà a {1} {2}", { 0: from?.name ?? "", 1: to?.name ?? "", 2: money(t.amount) });
}

/** The viewer's balance in one sentence: «Giulia ti deve 64,20 €», «Devi 40 € in tutto», «Siete pari». */
export function balanceHeadline(mine: number, transfers: readonly Transfer[], members: readonly HouseholdPerson[], money: (n: number) => string, tr: Tr): string {
  if (Math.abs(mine) < 0.005) return tr("Siete pari");
  const others = members.filter((m) => !m.isMe);
  if (others.length === 1) {
    return mine > 0 ? tr("{0} ti deve {1}", { 0: others[0].name, 1: money(mine) }) : tr("Devi {0} a {1}", { 0: money(-mine), 1: others[0].name });
  }
  const mineTransfers = transfers.filter((t) => members.find((m) => m.isMe && (m.userId === t.fromUserId || m.userId === t.toUserId)));
  if (mineTransfers.length === 1) return transferLine(mineTransfers[0], members, money, tr);
  return mine > 0 ? tr("Ti devono {0} in tutto", { 0: money(mine) }) : tr("Devi {0} in tutto", { 0: money(-mine) });
}
