"use client";

/**
 * Layout di Debiti: titolo e "Aggiungi debito". Il dialog di aggiunta vive qui, così ogni scheda può aprirlo.
 */

import * as React from "react";
import { Plus } from "lucide-react";
import { AddDebtDialog, DebtsActionsProvider } from "@/components/domain/debts";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

export default function DebitiLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = authClient.useSession();
  const [addOpen, setAddOpen] = React.useState(false);
  const actions = React.useMemo(() => ({ openAdd: () => setAddOpen(true) }), []);

  return (
    <DebtsActionsProvider value={actions}>
      <div className="mx-auto flex max-w-4xl flex-col gap-5 p-4 sm:gap-6 sm:p-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-heading text-2xl font-medium text-foreground">Debiti</h1>
              <p className="text-sm text-muted-foreground">Cosa pagare, cosa pesa, come uscirne</p>
            </div>
            <Button className="gap-1.5 shadow-xs" onClick={actions.openAdd}>
              <Plus size={15} aria-hidden="true" /> Aggiungi
            </Button>
          </div>
        </div>
        {children}
      </div>
      <AddDebtDialog open={addOpen} onOpenChange={setAddOpen} currency={session?.user.currency ?? "EUR"} />
    </DebtsActionsProvider>
  );
}
