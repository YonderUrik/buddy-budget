/** Shapes the group routes send to the screens («Gruppi»). */

import type { Transfer } from "./balance";

/** A member as the screens draw them: first name, initial and a stable colour slot (order of arrival). */
export interface HouseholdPerson {
  /** Member id: the identity used everywhere in a group (expenses, balances), also for people without an account. */
  id: string;
  /** Null for someone added by name who is not on BuddyBudget (yet). */
  userId: string | null;
  name: string;
  initial: string;
  isMe: boolean;
  /** 0 = the viewer, then the others in order of arrival: picks the avatar colour. */
  slot: number;
}

/** A group in lists (the switch in Panoramica, Settings, «In comune con»). */
export interface HouseholdSummary {
  id: string;
  name: string;
  members: HouseholdPerson[];
  pendingInvites: number;
}

/** One of the viewer's accounts in the sharing choice. */
export interface ShareableAccount {
  id: string;
  name: string;
  icon: string;
  color: string;
  balance: number;
  /** Shown to this group now. */
  shared: boolean;
  /** The app would tick it: the name says it holds money of the house. */
  suggested: boolean;
}

/** Everything the group page shows: who is in, who is invited, what the viewer shares. */
export interface HouseholdSettings {
  id: string;
  name: string;
  members: (HouseholdPerson & { sharesNetWorth: boolean; sharedAccounts: number; invite: PendingInvite | null })[];
  mine: { sharesNetWorth: boolean; accounts: ShareableAccount[] };
}

/** The open invitation of someone added by name. */
export interface PendingInvite {
  id: string;
  email: string | null;
  expiresAt: string;
}

/** An account a member shows the group. */
export interface HouseholdAccountRow {
  id: string;
  name: string;
  icon: string;
  color: string;
  balance: number;
  /** Member id of the owner. */
  ownerId: string;
  updatedAt: string;
}

/** One category of the month's household spending, with who paid in it. */
export interface HouseholdSpendingRow {
  name: string;
  icon: string;
  color: string;
  amount: number;
  payerIds: string[];
}

/** The group view («Noi due» in Panoramica). */
export interface HouseholdOverview {
  id: string;
  name: string;
  /** First day of the month the spending refers to (YYYY-MM-DD). */
  month: string;
  members: HouseholdPerson[];
  /** Net worth of the members who show it; null when nobody does. */
  netWorth: { total: number; parts: { memberId: string; amount: number }[]; hiddenMemberIds: string[] } | null;
  balance: {
    /** The viewer's balance: positive = the others owe them. */
    mine: number;
    /** Fewest payments that even the group out. */
    transfers: Transfer[];
    /** Shared expenses since the last time the group evened out, and what each member paid of them. */
    expenseCount: number;
    paid: { memberId: string; amount: number }[];
  };
  spending: { total: number; rows: HouseholdSpendingRow[] };
  accounts: HouseholdAccountRow[];
}

/** A transaction of a shared account, as the other members see it (read-only). */
export interface HouseholdAccountTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: { name: string; icon: string; color: string } | null;
}

/** One expense of the group as its list shows it: from someone's bank or written in the group. */
export interface HouseholdExpenseEntry {
  id: string;
  /** «movimento» = a member's own transaction marked in common, «gruppo» = written in the group. */
  kind: "movimento" | "gruppo";
  date: string;
  description: string;
  amount: number;
  payerId: string;
  /** Who it is for, resolved (everyone when it was for everyone). */
  forIds: string[];
  /** Null when it was for everyone. */
  chosenForIds: string[] | null;
  /** What it means for the viewer: positive = the others owe them for it. */
  mine: number;
  category: { id: string | null; name: string; icon: string; color: string } | null;
  /** The viewer can change it here: any expense written in the group (theirs open in Movimenti). */
  editable: boolean;
  /** Written before the last time the group evened out. */
  settled: boolean;
}

/** The choice on one expense: shared with a group, mine only, or not chosen (a rule may decide). */
export interface TransactionHouseholdChoice {
  householdId: string | null;
  /** Who it is for (member ids, null = everyone in the group). */
  forMemberIds: string[] | null;
  /** «manuale» = the owner chose it, «regola» = a merchant rule did, null = nothing applies. */
  source: "manuale" | "regola" | null;
  /** The merchant has a rule for this group. */
  ruleHouseholdId: string | null;
  /** The transaction sits on an account shared with a group: it is already common money. */
  onSharedAccount: boolean;
}
