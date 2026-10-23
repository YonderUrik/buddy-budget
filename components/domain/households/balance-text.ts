import type { Transfer } from "@/lib/households/balance";
import type { HouseholdPerson } from "@/lib/households/types";

type Tr = (text: string, values?: Record<string, string | number>) => string;

/** «Giulia dà a te 64,20 €», «Tu dai a Giulia …», «Marco dà a Sara …». */
export function transferLine(t: Transfer, members: readonly HouseholdPerson[], money: (n: number) => string, tr: Tr): string {
  const from = members.find((m) => m.id === t.from);
  const to = members.find((m) => m.id === t.to);
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
  const me = members.find((m) => m.isMe);
  const mineTransfers = transfers.filter((t) => me && (t.from === me.id || t.to === me.id));
  if (mineTransfers.length === 1) return transferLine(mineTransfers[0], members, money, tr);
  return mine > 0 ? tr("Ti devono {0} in tutto", { 0: money(mine) }) : tr("Devi {0} in tutto", { 0: money(-mine) });
}

/**
 * What a split means, in one sentence: «A metà con Marco: ti deve 15,65 €», «L'hai pagata tutta per Marco: ti deve
 * 31,30 €», «Divisa tra te, Sara e Luca: 30,00 € a testa». `forIds` null = everyone in the group.
 */
export function splitLine(amount: number, payerId: string, forIds: readonly string[] | null, members: readonly HouseholdPerson[], money: (n: number) => string, tr: Tr): string {
  const people = forIds ? members.filter((m) => forIds.includes(m.id)) : [...members];
  const payer = members.find((m) => m.id === payerId);
  if (!payer || people.length === 0) return "";
  const name = (m: HouseholdPerson) => (m.isMe ? tr("te") : m.name);
  const each = money(amount / people.length);
  if (people.length === 1 && people[0].id !== payerId) {
    const other = people[0];
    if (payer.isMe) return tr("L'hai pagata tutta per {0}: ti deve {1}.", { 0: other.name, 1: money(amount) });
    if (other.isMe) return tr("{0} l'ha pagata tutta per te: devi {1}.", { 0: payer.name, 1: money(amount) });
    return tr("{0} l'ha pagata tutta per {1}.", { 0: payer.name, 1: other.name });
  }
  if (people.length === 1) return tr("Solo per chi l'ha pagata: non sposta il conto tra voi.");
  if (people.length === 2 && people.some((p) => p.id === payerId)) {
    const other = people.find((p) => p.id !== payerId)!;
    if (payer.isMe) return tr("A metà con {0}: ti deve {1}.", { 0: other.name, 1: each });
    if (other.isMe) return tr("A metà con {0}: devi {1}.", { 0: payer.name, 1: each });
    return tr("A metà tra {0} e {1}: {2} a testa.", { 0: payer.name, 1: other.name, 2: each });
  }
  if (!forIds) return tr("In parti uguali tra tutti e {0}: {1} a testa.", { 0: people.length, 1: each });
  const names = people.map(name);
  return tr("Divisa tra {0}: {1} a testa.", { 0: names.length > 1 ? tr("{0} e {1}", { 0: names.slice(0, -1).join(", "), 1: names.at(-1)! }) : names[0], 1: each });
}
