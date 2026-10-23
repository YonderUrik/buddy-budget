"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { track } from "@/lib/analytics";
import { splitKind } from "@/lib/households/balance";
import type {
  HouseholdAccountRow,
  HouseholdAccountTransaction,
  HouseholdExpenseEntry,
  HouseholdOverview,
  HouseholdPerson,
  HouseholdSettings,
  HouseholdSummary,
  TransactionHouseholdChoice,
} from "@/lib/households/types";
import { pageText } from "@/lib/localization/page-text";

/** Everything about groups starts with this key: one invalidation refreshes lists, views and shared accounts. */
export const HOUSEHOLDS_QUERY_KEY = ["households"] as const;
/** Groups change rarely; the views a bit more (the others' expenses), so they stay fresh for a minute. */
const HOUSEHOLDS_STALE_MS = 60_000;

/** What a member shows a group, as the forms send it. */
export interface SharingPayload {
  sharesNetWorth: boolean;
  accountIds: string[];
}

/** Others' accounts shown to the viewer, and the groups each of the viewer's accounts is shown to. */
export interface SharedAccountsView {
  withMe: (HouseholdAccountRow & { householdId: string; householdName: string; ownerName: string; ownerInitial: string; ownerSlot: number })[];
  mine: Record<string, string[]>;
}

async function readError(response: Response, fallback: string): Promise<Error> {
  const body = await response.json().catch(() => null);
  return new Error(body?.error ?? pageText(fallback));
}

async function getJson<T>(url: string, fallback: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw await readError(response, fallback);
  return response.json();
}

async function send<T>(url: string, method: string, body: unknown, fallback: string): Promise<T> {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!response.ok) throw await readError(response, fallback);
  return (response.status === 204 ? null : await response.json()) as T;
}

/** The viewer's groups (the Panoramica switch, Settings, «In comune con»). */
export function useHouseholdsQuery() {
  return useQuery({
    queryKey: HOUSEHOLDS_QUERY_KEY,
    staleTime: HOUSEHOLDS_STALE_MS,
    queryFn: () => getJson<HouseholdSummary[]>("/api/households", "Impossibile caricare i gruppi"),
  });
}

/** The group page (and the last step of «Nuovo gruppo», once the group exists). */
export function useHouseholdSettingsQuery(id: string | null) {
  return useQuery({
    queryKey: [...HOUSEHOLDS_QUERY_KEY, id, "settings"],
    enabled: Boolean(id),
    queryFn: () => getJson<HouseholdSettings>(`/api/households/${id}`, "Impossibile caricare il gruppo"),
  });
}

/** The group view for a month (YYYY-MM). */
export function useHouseholdOverviewQuery(id: string | null, month: string) {
  return useQuery({
    queryKey: [...HOUSEHOLDS_QUERY_KEY, id, "overview", month],
    enabled: Boolean(id),
    staleTime: HOUSEHOLDS_STALE_MS,
    queryFn: () => getJson<HouseholdOverview>(`/api/households/${id}/overview?month=${month}`, "Impossibile caricare il gruppo"),
  });
}

/** An account shown to a group, with its transactions. */
export function useHouseholdAccountQuery(id: string, accountId: string) {
  return useQuery({
    queryKey: [...HOUSEHOLDS_QUERY_KEY, id, "account", accountId],
    queryFn: () =>
      getJson<{ account: HouseholdAccountRow; owner: HouseholdPerson; transactions: HouseholdAccountTransaction[] }>(`/api/households/${id}/accounts/${accountId}`, "Impossibile caricare il conto"),
  });
}

/** Shared accounts for Conti. */
export function useSharedAccountsQuery() {
  return useQuery({
    queryKey: [...HOUSEHOLDS_QUERY_KEY, "shared-accounts"],
    staleTime: HOUSEHOLDS_STALE_MS,
    queryFn: () => getJson<SharedAccountsView>("/api/households/shared-accounts", "Impossibile caricare i conti in comune"),
  });
}

/** The group's expenses that count between the members. */
export function useHouseholdExpensesQuery(id: string) {
  return useQuery({
    queryKey: [...HOUSEHOLDS_QUERY_KEY, id, "expenses"],
    staleTime: HOUSEHOLDS_STALE_MS,
    queryFn: () =>
      getJson<{ members: HouseholdPerson[]; expenses: HouseholdExpenseEntry[]; lastSettledAt: string | null }>(`/api/households/${id}/expenses`, "Impossibile caricare le spese del gruppo"),
  });
}

/** Who pays one expense. */
export function useTransactionHouseholdQuery(transactionId: string, enabled = true) {
  return useQuery({
    queryKey: [...HOUSEHOLDS_QUERY_KEY, "transaction", transactionId],
    enabled,
    queryFn: () => getJson<TransactionHouseholdChoice>(`/api/transactions/${transactionId}/household`, "Impossibile caricare il movimento"),
  });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: HOUSEHOLDS_QUERY_KEY });
}

/** Creates a group; answers its id. */
export function useCreateHouseholdMutation() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { name: string; sharing: SharingPayload }) => send<{ id: string }>("/api/households", "POST", input, "Impossibile creare il gruppo"),
    onSuccess: (_data, input) => {
      track("household_created", { accounts: input.sharing.accountIds.length, netWorth: input.sharing.sharesNetWorth });
      return invalidate();
    },
  });
}

/** Renames a group or changes what the viewer shows it. */
export function useUpdateHouseholdMutation(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { name?: string; sharing?: SharingPayload }) => send<null>(`/api/households/${id}`, "PATCH", input, "Impossibile salvare"),
    onSuccess: (_data, input) => {
      if (input.sharing) track("household_sharing_changed", { accounts: input.sharing.accountIds.length, netWorth: input.sharing.sharesNetWorth });
      return invalidate();
    },
  });
}

/** Adds someone by name; with an email the app also invites them. Answers their member id and the invitation link. */
export function useAddPersonMutation(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { name: string; email: string | null }) =>
      send<{ id: string; url: string | null; emailed: boolean }>(`/api/households/${id}/members`, "POST", input, "Impossibile aggiungere la persona"),
    onSuccess: (_data, input) => {
      track("household_person_added", { invite: input.email ? "email" : "none" });
      return invalidate();
    },
  });
}

/** Removes someone added by name. */
export function useRemovePersonMutation(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (memberId: string) => send<null>(`/api/households/${id}/members/${memberId}`, "DELETE", undefined, "Impossibile togliere la persona"),
    onSuccess: () => {
      track("household_person_removed");
      return invalidate();
    },
  });
}

/** Invites someone added by name (or only creates the link to share by hand); answers the link. */
export function useInviteMemberMutation(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { memberId: string; email: string | null }) =>
      send<{ url: string; emailed: boolean }>(`/api/households/${id}/members/${input.memberId}/invite`, "POST", { email: input.email }, "Impossibile creare l'invito"),
    onSuccess: (_data, input) => {
      track("household_invite_sent", { channel: input.email ? "email" : "link" });
      return invalidate();
    },
  });
}

/** An expense written in the group, as the form sends it. */
export interface GroupExpensePayload {
  description: string;
  amount: number;
  date: string;
  paidByMemberId: string;
  forMemberIds: string[] | null;
  categoryId: string | null;
}

/** Writes (`expenseId` null) or changes an expense of the group. `myMemberId` only feeds the analytics event. */
export function useSaveGroupExpenseMutation(id: string, myMemberId: string | null) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { expenseId: string | null; expense: GroupExpensePayload }) =>
      input.expenseId
        ? send<null>(`/api/households/${id}/expenses/${input.expenseId}`, "PATCH", input.expense, "Impossibile salvare la spesa")
        : send<{ id: string }>(`/api/households/${id}/expenses`, "POST", input.expense, "Impossibile salvare la spesa"),
    onSuccess: (_data, input) => {
      track("household_group_expense_saved", {
        mode: input.expenseId ? "edit" : "create",
        people: splitKind(input.expense.forMemberIds, input.expense.paidByMemberId),
        paidByMe: input.expense.paidByMemberId === myMemberId,
      });
      return invalidate();
    },
  });
}

/** Deletes an expense written in the group. */
export function useDeleteGroupExpenseMutation(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (expenseId: string) => send<null>(`/api/households/${id}/expenses/${expenseId}`, "DELETE", undefined, "Impossibile eliminare la spesa"),
    onSuccess: () => {
      track("household_group_expense_deleted");
      return invalidate();
    },
  });
}

/** Withdraws a pending invitation. */
export function useRevokeInviteMutation(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (inviteId: string) => send<null>(`/api/households/${id}/invites/${inviteId}`, "DELETE", undefined, "Impossibile annullare l'invito"),
    onSuccess: () => invalidate(),
  });
}

/** Accepts an invitation with what the viewer shows; answers the group id. */
export function useAcceptInviteMutation(token: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (sharing: SharingPayload) => send<{ id: string }>(`/api/invites/${token}/accept`, "POST", { sharing }, "Impossibile accettare l'invito"),
    onSuccess: (_data, sharing) => {
      track("household_invite_accepted", { accounts: sharing.accountIds.length, netWorth: sharing.sharesNetWorth });
      return invalidate();
    },
  });
}

/** Leaves a group. */
export function useLeaveHouseholdMutation(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => send<null>(`/api/households/${id}/membership`, "DELETE", undefined, "Impossibile uscire dal gruppo"),
    onSuccess: () => {
      track("household_left");
      return invalidate();
    },
  });
}

/** «Pareggiate». */
export function useSettleHouseholdMutation(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => send<{ transfers: number }>(`/api/households/${id}/settle`, "POST", undefined, "Impossibile pareggiare"),
    onSuccess: (data) => {
      track("household_settled", { transfers: data.transfers });
      return invalidate();
    },
  });
}

/** Sets who pays an expense: the group and who it is for (null = everyone). `myMemberId` only feeds analytics. */
export function useSetTransactionHouseholdMutation(transactionId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { householdId: string | null; forMemberIds: string[] | null; rule: "set" | "clear" | "keep"; myMemberId?: string }) =>
      send<null>(`/api/transactions/${transactionId}/household`, "PUT", { householdId: input.householdId, forMemberIds: input.forMemberIds, rule: input.rule }, "Impossibile salvare"),
    onSuccess: (_data, input) => {
      track("household_expense_changed", { shared: input.householdId !== null, remember: input.rule === "set", people: splitKind(input.forMemberIds, input.myMemberId ?? "") });
      return invalidate();
    },
  });
}
