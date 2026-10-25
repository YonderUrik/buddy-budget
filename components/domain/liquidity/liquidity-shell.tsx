"use client";

/**
 * Liquidità frame: shared state, heading with tabs and the section's dialogs (new movement and new account for the empty
 * states, renewing a bank connection). Tabs are real pages inside `children`; `?rinnova=` in the banner and email links
 * opens the renewal. Adding from anywhere else goes through the app-wide «Aggiungi».
 */

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AddTransactionDialog } from "@/components/domain/expenses";
import { track } from "@/lib/analytics";
import { authClient } from "@/lib/auth/client";
import { useAccountsQuery } from "@/lib/queries/accounts";
import { useMarkMovementsSeen } from "@/lib/queries/attention";
import { useCategoriesQuery } from "@/lib/queries/categories";
import { AddAccountDialog } from "./add-account-dialog";
import { LiquidityActionsProvider } from "./liquidity-actions";
import { LiquidityProvider } from "./liquidity-context";
import { LiquidityHeader } from "./liquidity-header";
import { LiquidityNoAccounts, NO_ACCOUNT_TABS } from "./liquidity-no-accounts";
import { LIQUIDITY_ACCOUNT_PARAM, LIQUIDITY_TABS } from "./liquidity-nav";
import { PAGE_FRAME } from "@/components/domain/shared";

const SUBTITLE = "Conti, saldi e movimenti in un posto solo";

function Frame({ children }: { children: React.ReactNode }) {
  useMarkMovementsSeen();
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const { data: categories } = useCategoriesQuery();
  // Before the first account, the tabs that need one say what they will show instead of zeros and empty charts.
  const { data: accounts } = useAccountsQuery();
  const needsAccount = accounts !== undefined && accounts.length === 0 && pathname in NO_ACCOUNT_TABS;
  const [addTransactionOpen, setAddTransactionOpen] = React.useState(false);
  const [accountDialog, setAccountDialog] = React.useState<{ open: boolean; renew: boolean }>({ open: false, renew: false });

  const addAccount = React.useCallback(() => setAccountDialog({ open: true, renew: false }), []);
  const renew = React.useCallback((source: "banner" | "row") => {
    track("bank_renew_started", { source });
    setAccountDialog({ open: true, renew: true });
  }, []);
  const actions = React.useMemo(() => ({ addAccount, renew, addTransaction: () => setAddTransactionOpen(true) }), [addAccount, renew]);

  // Il link dell'email (?rinnova=1) e quello della Panoramica (?rinnova=panoramica, ?rinnova=sidebar) aprono subito il rinnovo, una volta sola.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const origin = params.get("rinnova");
    if (!origin) return;
    params.delete("rinnova");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    const timer = window.setTimeout(() => {
      track("bank_renew_started", { source: origin === "panoramica" || origin === "sidebar" ? origin : "email" });
      setAccountDialog({ open: true, renew: true });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <LiquidityActionsProvider value={actions}>
      <div className={PAGE_FRAME}>
        <LiquidityHeader subtitle={SUBTITLE} tabs={LIQUIDITY_TABS} activeHref={pathname} />
        {needsAccount ? <LiquidityNoAccounts href={pathname} onAddAccount={addAccount} /> : children}
      </div>
      <AddTransactionDialog
        open={addTransactionOpen}
        onOpenChange={setAddTransactionOpen}
        categories={categories ?? []}
        currency={currency}
        onAddAccount={() => { setAddTransactionOpen(false); addAccount(); }}
      />
      <AddAccountDialog
        open={accountDialog.open}
        onOpenChange={(open) => setAccountDialog((s) => ({ ...s, open }))}
        currency={currency}
        renew={accountDialog.renew}
      />
    </LiquidityActionsProvider>
  );
}

/** Contenitore della sezione; `useSearchParams` richiede il confine Suspense. */
export function LiquidityShell({ children }: { children: React.ReactNode }) {
  return (
    <React.Suspense fallback={null}>
      <WithAccountParam>{children}</WithAccountParam>
    </React.Suspense>
  );
}

function WithAccountParam({ children }: { children: React.ReactNode }) {
  const accountParam = useSearchParams().get(LIQUIDITY_ACCOUNT_PARAM);
  return (
    <LiquidityProvider initialAccountId={accountParam}>
      <Frame>{children}</Frame>
    </LiquidityProvider>
  );
}

