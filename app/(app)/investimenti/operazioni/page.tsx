"use client";

/** Scheda Operazioni di Investimenti: tutte le operazioni per mese, con l'esito di ciascuna, i totali la modifica e l'eliminazione. */

import * as React from "react";
import { toast } from "sonner";
import { EditOperationDialog, ImportManagement, InvestmentsViewGate, InvestmentTransactionsList } from "@/components/domain/investments";
import type { InvestmentTransaction } from "@/lib/db/schema/investments";
import { INVESTMENTS_DEFAULT_PERIOD } from "@/lib/investments/labels";
import { useDeleteInvestmentTransactionMutation } from "@/lib/queries/investments";
import { useInvestmentsView } from "@/lib/queries/investments-view";

export default function OperazioniPage() {
  const { overview, view } = useInvestmentsView(INVESTMENTS_DEFAULT_PERIOD);
  const deleteOperation = useDeleteInvestmentTransactionMutation();
  const [showAll, setShowAll] = React.useState(false);
  const [editing, setEditing] = React.useState<InvestmentTransaction | null>(null);

  return (
    <>
      <ImportManagement />
      <InvestmentsViewGate
        loading={overview.isLoading}
        error={overview.isError || (!overview.isLoading && !view)}
        empty={!!view && !view.hasTransactions}
        onRetry={() => overview.refetch()}
      >
        {view ? (
          <InvestmentTransactionsList
            months={view.operationMonths}
            instrumentsById={view.instrumentsById}
            currency={view.currency}
            showAll={showAll}
            onToggleShowAll={() => setShowAll((v) => !v)}
            deletingId={deleteOperation.isPending ? deleteOperation.variables : null}
            onEdit={setEditing}
            onDelete={(t) => deleteOperation.mutate(t.id, { onError: (e) => toast.error(e.message) })}
          />
        ) : null}
        <EditOperationDialog
          transaction={editing}
          instrument={editing ? view?.instrumentsById.get(editing.instrumentId) : undefined}
          currency={view?.currency ?? "EUR"}
          onClose={() => setEditing(null)}
        />
      </InvestmentsViewGate>
    </>
  );
}
