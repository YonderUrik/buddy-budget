"use client";

/** Liquidità · Conti: avviso di rinnovo, conti per banca con stato e saldo, collegamento di una banca o di un conto a mano. */

import * as React from "react";
import { useRouter } from "next/navigation";
import { BanknoteIcon, LandmarkIcon, PlusIcon } from "lucide-react";
import {
  AccountDetailsDialog,
  RenewalBanner,
  buildAccountStatus,
  buildRenewalAlerts,
  groupAccounts,
  sumBalances,
} from "@/components/domain/accounts";
import { EmptyState, LoadError } from "@/components/domain/shared";
import { AccountLine, LIQUIDITY_ACCOUNT_PARAM, LIQUIDITY_HREF, SectionTitle, useLiquidity, useLiquidityActions } from "@/components/domain/liquidity";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { authClient } from "@/lib/auth/client";
import { startOfDay } from "@/lib/calc/expenses";
import { toDateKey } from "@/lib/calc/net-worth";
import { computeConnectionHealth, needsRenewal } from "@/lib/gocardless/connection-health";
import { buildAccountBalanceSeries } from "@/lib/liquidity/account-series";
import { formatCurrency } from "@/lib/format";
import { useAccountsQuery } from "@/lib/queries/accounts";
import { useBankConnectionsStatusQuery } from "@/lib/queries/gocardless";
import { useSyncJobsQuery } from "@/lib/queries/sync-jobs";
import { useTransactionsQuery } from "@/lib/queries/transactions";
import { isAccountSyncing } from "@/lib/sync-jobs/view";
import type { AccountColor, AccountIcon } from "@/lib/validation/accounts";

/** Giorni di storia nella miniatura di ogni conto. */
const TREND_DAYS = 30;

export default function LiquiditaContiPage() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const { today: now, setAccountId } = useLiquidity();
  const { addAccount, renew } = useLiquidityActions();
  const today = React.useMemo(() => startOfDay(now), [now]);
  const [openId, setOpenId] = React.useState<string | null>(null);

  React.useEffect(() => track("liquidity_tab_viewed", { tab: "conti" }), []);

  // Il link dei primi passi (?nuovo=1) apre subito «Nuovo conto», una volta sola.
  React.useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("nuovo")) return;
    // Il parametro si toglie solo allo scoccare del timer: in Strict Mode il primo effetto viene annullato e il secondo deve ritrovarlo.
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      params.delete("nuovo");
      const query = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
      addAccount();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [addAccount]);

  const { data: accounts, isLoading, isError, refetch } = useAccountsQuery();
  const connections = useBankConnectionsStatusQuery().data ?? [];
  const syncJobs = useSyncJobsQuery().data ?? [];
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - TREND_DAYS);
  const transactions = useTransactionsQuery(toDateKey(from), toDateKey(today), "tutte").data ?? [];

  const list = accounts ?? [];
  const reconnectIds = new Set(connections.filter((c) => needsRenewal(computeConnectionHealth(c, today).state)).map((c) => c.accountId));
  const bankByAccountId = new Map(connections.map((c) => [c.accountId, c.institutionName]));
  const syncInfoById = new Map(connections.map((c) => [c.accountId, { lastSyncedAt: c.lastSyncedAt, eligible: c.eligible, nextEligibleAt: c.nextEligibleAt, syncsRemainingToday: c.syncsRemainingToday }]));
  const groups = groupAccounts(list, bankByAccountId);
  const alerts = buildRenewalAlerts(connections, today);
  const open = list.find((a) => a.id === openId) ?? null;

  function showMovements(accountId: string) {
    setAccountId(accountId);
    router.push(`${LIQUIDITY_HREF}?${LIQUIDITY_ACCOUNT_PARAM}=${accountId}`);
  }

  if (isError) return <LoadError message="Impossibile caricare i conti." onRetry={() => refetch()} />;
  return (
    <div className="flex flex-col gap-8" aria-busy={isLoading}>
      <RenewalBanner alerts={alerts} onRenew={() => renew("banner")} />
      {!isLoading && list.length === 0 ? (
        <EmptyState
          icon={LandmarkIcon}
          title="Nessun conto ancora"
          description="Collega la banca o aggiungi un conto a mano: bastano un nome e il saldo."
          primary={{ label: "Aggiungi il primo conto", onClick: addAccount }}
          secondary={{ label: "Importa un file", href: "/importazioni" }}
        />
      ) : (
        groups.map((group) => (
          <section key={group.key} aria-label={group.label}>
            <div className="flex items-baseline justify-between gap-3">
              <SectionTitle icon={group.key === "manuali" ? BanknoteIcon : LandmarkIcon} title={group.label} color="var(--swatch-teal)" />
              <span className="font-heading font-semibold tabular-nums">{formatCurrency(sumBalances(group.accounts), currency)}</span>
            </div>
            <p className="-mt-1 mb-3 text-sm text-text-2">{group.hint}</p>
            <ul className="flex flex-col gap-2">
              {group.accounts.map((account) => {
                const status = buildAccountStatus({
                  isAuto: account.source === "auto",
                  needsReconnect: reconnectIds.has(account.id),
                  syncing: isAccountSyncing(syncJobs, account.id),
                  syncInfo: syncInfoById.get(account.id),
                });
                return (
                  <AccountLine
                    key={account.id}
                    name={account.name}
                    type={account.type}
                    color={account.color as AccountColor}
                    icon={account.icon as AccountIcon}
                    balance={Number(account.balance)}
                    currency={currency}
                    status={status.label}
                    statusTone={status.tone}
                    trend={account.source === "auto" ? buildAccountBalanceSeries(account, transactions, from, today).map((p) => p.value) : undefined}
                    onOpen={() => {
                      track("account_details_opened", { kind: account.source === "auto" ? "collegato" : "manuale" });
                      setOpenId(account.id);
                    }}
                    onShowMovements={() => showMovements(account.id)}
                  />
                );
              })}
            </ul>
          </section>
        ))
      )}
      {list.length > 0 && (
        <div className="flex flex-wrap gap-2.5">
          <Button className="h-11 gap-1.5" onClick={addAccount}>
            <PlusIcon className="size-4" aria-hidden="true" /> Aggiungi un conto
          </Button>
        </div>
      )}
      <AccountDetailsDialog
        account={open}
        currency={currency}
        needsReconnect={open ? reconnectIds.has(open.id) : false}
        syncInfo={open ? syncInfoById.get(open.id) : undefined}
        syncing={open ? isAccountSyncing(syncJobs, open.id) : false}
        movementsHref={open ? `${LIQUIDITY_HREF}?${LIQUIDITY_ACCOUNT_PARAM}=${open.id}` : undefined}
        onClose={() => setOpenId(null)}
        onReconnect={() => renew("row")}
      />
    </div>
  );
}
