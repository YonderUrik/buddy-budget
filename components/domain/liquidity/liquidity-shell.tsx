"use client";

/**
 * Struttura di Liquidità: stato condiviso, testata con schede e i dialog globali (nuovo movimento, nuovo conto, rinnovo
 * del collegamento). Le schede sono pagine vere dentro `children`; nei link del banner e dell'email `?rinnova=` apre il rinnovo.
 */

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ReceiptTextIcon } from "lucide-react";
import { AddTransactionForm } from "@/components/domain/expenses";
import { PanelDialogHeader } from "@/components/domain/investments";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { authClient } from "@/lib/auth/client";
import { useMarkMovementsSeen } from "@/lib/queries/attention";
import { useCategoriesQuery } from "@/lib/queries/categories";
import { AddAccountDialog } from "./add-account-dialog";
import { DialogCloseButton } from "./dialog-close-button";
import { LIQUIDITY_DIALOG_CLASS } from "./dialog-layout";
import { LiquidityActionsProvider } from "./liquidity-actions";
import { LiquidityProvider } from "./liquidity-context";
import { LiquidityHeader } from "./liquidity-header";
import { LIQUIDITY_ACCOUNT_PARAM, LIQUIDITY_TABS } from "./liquidity-nav";

const IMPORT_HREF = "/importazioni";
const SUBTITLE = "Conti, saldi e movimenti in un posto solo";

function Frame({ children }: { children: React.ReactNode }) {
  useMarkMovementsSeen();
  const pathname = usePathname();
  const router = useRouter();
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
      <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 sm:p-6">
        <LiquidityHeader subtitle={SUBTITLE} tabs={LIQUIDITY_TABS} activeHref={pathname} onAddTransaction={actions.addTransaction} onAddAccount={addAccount} onImport={() => router.push(IMPORT_HREF)} />
        {children}
      </div>
      <Dialog open={addTransactionOpen} onOpenChange={setAddTransactionOpen}>
        <DialogContent className={cn(LIQUIDITY_DIALOG_CLASS)}>
          <DialogCloseButton />
          <PanelDialogHeader className="pr-10" icon={ReceiptTextIcon} title="Nuovo movimento" description="Una spesa o un'entrata su un conto manuale." />
          <AddTransactionForm
            categories={categories ?? []}
            currency={currency}
            stacked
            onSuccess={() => setAddTransactionOpen(false)}
            onAddAccount={() => { setAddTransactionOpen(false); addAccount(); }}
          />
        </DialogContent>
      </Dialog>
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

