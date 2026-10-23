"use client";

/**
 * «In comune con» in a transaction's detail: «Solo mia» or one of the viewer's groups, in equal parts. Choosing a group
 * also sends the merchant's next expenses there (the toast offers «Solo questa»); a merchant rule shows where it
 * came from. Hidden for people without groups, income and transfers; on a shared account it only says so.
 */

import { toast } from "sonner";
import { SegmentedControl } from "@/components/domain/shared";
import { localizedFormats } from "@/lib/localization/format";
import { useLocalization } from "@/lib/localization/provider";
import { useHouseholdsQuery, useSetTransactionHouseholdMutation, useTransactionHouseholdQuery } from "@/lib/queries/households";

/** Value of «Solo mia» in the switch. */
const MINE = "mine";

export interface MovementHouseholdChoiceProps {
  transactionId: string;
  /** The merchant as the list shows it («Esselunga»). */
  merchant: string;
  /** Positive amount of the expense. */
  amount: number;
  currency: string;
  /** Only expenses can be shared (not income, not transfers). */
  shareable: boolean;
}

export function MovementHouseholdChoice({ transactionId, merchant, amount, currency, shareable }: MovementHouseholdChoiceProps) {
  const { t: tr, locale } = useLocalization();
  const { formatCurrency } = localizedFormats(locale);
  const groups = useHouseholdsQuery().data ?? [];
  const enabled = shareable && groups.length > 0;
  const { data: choice } = useTransactionHouseholdQuery(transactionId, enabled);
  const set = useSetTransactionHouseholdMutation(transactionId);
  if (!enabled || !choice) return null;

  if (choice.onSharedAccount) {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-sm text-text-2">{tr("In comune con")}</p>
        <p>{tr("Il conto è in comune: questa spesa è già di tutto il gruppo.")}</p>
      </div>
    );
  }

  const current = choice.householdId ?? MINE;
  const group = groups.find((g) => g.id === choice.householdId);
  const others = group?.members.filter((m) => !m.isMe) ?? [];
  const share = group ? amount / group.members.length : 0;

  function choose(value: string) {
    const householdId = value === MINE ? null : value;
    if (householdId === choice!.householdId && choice!.source === "manuale") return;
    const name = groups.find((g) => g.id === householdId)?.name;
    set.mutate(
      { householdId, rule: householdId ? "set" : "keep" },
      {
        onSuccess: () => {
          if (householdId) {
            toast.success(tr("In comune con «{0}», anche le prossime da {1}", { 0: name ?? "", 1: merchant }), {
              action: { label: tr("Solo questa"), onClick: () => set.mutate({ householdId, rule: "clear" }) },
            });
          } else if (choice!.ruleHouseholdId) {
            toast.success(tr("Solo tua, questa volta"), {
              action: { label: tr("Anche le prossime"), onClick: () => set.mutate({ householdId: null, rule: "clear" }) },
            });
          }
        },
      }
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <p className="font-semibold">{tr("In comune con")}</p>
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <SegmentedControl
          options={[{ value: MINE, label: tr("Solo mia") }, ...groups.map((g) => ({ value: g.id, label: g.name }))]}
          value={current}
          onChange={choose}
          ariaLabel="In comune con"
          stretch={groups.length < 3}
        />
      </div>
      {group ? (
        <p className="text-sm text-text-2">
          {others.length === 1
            ? tr("A metà con {0}: ti deve {1} per questa spesa.", { 0: others[0].name, 1: formatCurrency(share, currency) })
            : tr("In parti uguali con {0}: {1} a testa.", { 0: others.map((o) => o.name).join(", "), 1: formatCurrency(share, currency) })}{" "}
          {choice.source === "regola"
            ? tr("Messa qui dall'app: le spese da {0} vanno in «{1}».", { 0: merchant, 1: group.name })
            : choice.ruleHouseholdId === group.id
              ? tr("Anche le prossime da {0} vanno qui da sole.", { 0: merchant })
              : null}
        </p>
      ) : (
        <p className="text-sm text-text-2">{tr("La paghi tu e conta solo per te.")}</p>
      )}
    </div>
  );
}
