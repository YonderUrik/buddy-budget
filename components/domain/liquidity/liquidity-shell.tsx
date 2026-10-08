"use client";

/**
 * Struttura di Liquidità: stato condiviso, testata con schede e i dialog globali (nuovo movimento, nuovo conto, rinnovo
 * del collegamento). Le schede sono pagine vere dentro `children`; nei link del banner e dell'email `?rinnova=` apre il rinnovo.
 */

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AddAccountForm } from "@/components/domain/accounts";
import { AddTransactionForm } from "@/components/domain/expenses";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { track } from "@/lib/analytics";
import { authClient } from "@/lib/auth/client";
import { useMarkMovementsSeen } from "@/lib/queries/attention";
import { useCategoriesQuery } from "@/lib/queries/categories";
import { LiquidityActionsProvider } from "./liquidity-actions";
import { LiquidityProvider } from "./liquidity-context";
import { LiquidityHeader } from "./liquidity-header";
import { LIQUIDITY_ACCOUNT_PARAM, LIQUIDITY_TABS } from "./liquidity-nav";

const SUBTITLE = "Conti, saldi e movimenti in un posto solo";

function Frame({ children }: { children: React.ReactNode }) {
  useMarkMovementsSeen();
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const { data: categories } = useCategoriesQuery();
  const [addTransactionOpen, setAddTransactionOpen] = React.useState(false);
  const [accountDialog, setAccountDialog] = React.useState<{ open: boolean; renew: boolean }>({ open: false, renew: false });

  const addAccount = React.useCallback(() => setAccountDialog({ open: true, renew: false }), []);
  const renew = React.useCallback((source: "banner" | "row") => {
    track("bank_renew_started", { source });
    setAccountDialog({ open: true, renew: true });
  }, []);
  const actions = React.useMemo(() => ({ addAccount, renew, addTransaction: () => setAddTransactionOpen(true) }), [addAccount, renew]);

  // Il link dell'email (?rinnova=1) e quello della Panoramica (?rinnova=panoramica) aprono subito il rinnovo, una volta sola.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const origin = params.get("rinnova");
    if (!origin) return;
    params.delete("rinnova");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    const timer = window.setTimeout(() => {
      track("bank_renew_started", { source: origin === "panoramica" ? "panoramica" : "email" });
      setAccountDialog({ open: true, renew: true });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <LiquidityActionsProvider value={actions}>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 sm:p-6">
        <LiquidityHeader subtitle={SUBTITLE} tabs={LIQUIDITY_TABS} activeHref={pathname} onAddTransaction={actions.addTransaction} onAddAccount={addAccount} />
        {children}
      </div>
      <Dialog open={addTransactionOpen} onOpenChange={setAddTransactionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuovo movimento</DialogTitle>
          </DialogHeader>
          <AddTransactionForm categories={categories ?? []} currency={currency} stacked onSuccess={() => setAddTransactionOpen(false)} />
        </DialogContent>
      </Dialog>
      <Dialog open={accountDialog.open} onOpenChange={(open) => setAccountDialog((s) => ({ ...s, open }))}>
        <DialogContent className="max-h-[92dvh] max-w-md overflow-y-auto p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>Nuovo conto</DialogTitle>
          </DialogHeader>
          <AddAccountForm
            key={accountDialog.renew ? "rinnovo" : "nuovo"}
            currency={currency}
            mode={accountDialog.renew ? "collega-banca" : undefined}
            onSuccess={() => setAccountDialog({ open: false, renew: false })}
          />
        </DialogContent>
      </Dialog>
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

