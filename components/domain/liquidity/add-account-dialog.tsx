"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * «Nuovo conto» dialog: starts from a choice (connect the bank, manual account, import a file) and leads to the right
 * step, with a way back on each one; Trade Republic signs in inside the dialog. Full screen on the phone. `renew` opens
 * the bank connection directly.
 */

import { FormDialogContent } from "@/components/domain/shared";
import Link from "next/link";
import * as React from "react";
import { ArrowLeftIcon, ChevronRightIcon, FileSpreadsheetIcon, LandmarkIcon, PencilLineIcon, ZapIcon } from "lucide-react";
import { AddAccountForm } from "@/components/domain/accounts";
import { ConnectTradeRepublic } from "@/components/domain/trade-republic";
import { PanelDialogHeader } from "@/components/domain/investments/light";
import { Dialog } from "@/components/ui/dialog";
import { track } from "@/lib/analytics";
import { useBankCapacityQuery } from "@/lib/queries/gocardless";
import { useInstance } from "@/lib/instance/provider";
import { BankPicker } from "./bank-picker";

export type AddAccountView = "scelta" | "banca" | "trade-republic" | "manuale";

const VIEW_COPY: Record<AddAccountView, { title: string; description: string }> = {
  scelta: { title: "Nuovo conto", description: "Come vuoi tenere aggiornato questo conto?" },
  banca: { title: "Collega la tua banca", description: "Scegli la banca: saldi e movimenti arrivano da soli." },
  "trade-republic": { title: "Trade Republic", description: "Saldo, movimenti e investimenti, aggiornati a ogni sincronizzazione." },
  manuale: { title: "Conto manuale", description: "Aggiungi tu i movimenti: il saldo li segue." },
};

/** Header of the bank step while only Trade Republic connects. */
const BANK_BLOCKED_COPY = { title: "Collega la tua banca", description: "Per ora si collega Trade Republic: le altre banche sono in arrivo." };

interface ChoiceProps {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  title: string;
  description: string;
  badge?: string;
  /** Scelta non disponibile: l'etichetta diventa neutra e la freccia sparisce. */
  unavailable?: boolean;
}

function ChoiceBody({ icon: Icon, color, title, description, badge, unavailable = false }: ChoiceProps) {
  const { t: tr } = useLocalization();
  return (
    <>
      <span className="grid size-11 shrink-0 place-items-center rounded-full" style={{ color, backgroundColor: `color-mix(in oklab, ${color} 16%, transparent)` }} aria-hidden="true">
        <Icon className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {tr(title)}
          {badge ? <span className={unavailable ? "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground" : "rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"}>{badge}</span> : null}
        </span>
        <span className="text-sm text-muted-foreground">{tr(description)}</span>
      </span>
      {unavailable ? null : <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
    </>
  );
}

const CHOICE_CLASS = "flex min-h-[4.5rem] w-full cursor-pointer items-center gap-3.5 rounded-xl border bg-background p-3.5 text-left transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-muted/30 disabled:hover:bg-muted/30";

export interface AddAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency: string;
  /** Apre subito il collegamento della banca (rinnovo di un consenso scaduto). */
  renew?: boolean;
}

export function AddAccountDialog({ open, onOpenChange, currency, renew = false }: AddAccountDialogProps) {

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FormDialogContent>
        {open ? <AddAccountSession key={renew ? "rinnovo" : "nuovo"} currency={currency} renew={renew} onClose={() => onOpenChange(false)} /> : null}
      </FormDialogContent>
    </Dialog>
  );
}

function AddAccountSession({ currency, renew, onClose }: { currency: string; renew: boolean; onClose: () => void }) {
  const { t: tr } = useLocalization();
  const [view, setView] = React.useState<AddAccountView>(renew ? "banca" : "scelta");
  // Il rinnovo non passa da qui: per la banca già collegata resta possibile anche a posti finiti (lo decide il server).
  const { data: capacity } = useBankCapacityQuery(!renew);
  const blockedReason = !renew && capacity && !capacity.canConnectNew ? capacity.reason : null;
  const { selfHosted } = useInstance();
  const seenReason = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!blockedReason || seenReason.current === blockedReason) return;
    seenReason.current = blockedReason;
    track("bank_connect_unavailable_seen", { reason: blockedReason });
  }, [blockedReason]);
  const go = (next: "banca" | "manuale") => {
    track("account_add_path_chosen", { path: next });
    setView(next);
  };
  const chooseTradeRepublic = () => {
    track("bank_provider_chosen", { provider: "trade-republic" });
    setView("trade-republic");
  };
  const copy = view === "banca" && blockedReason ? BANK_BLOCKED_COPY : VIEW_COPY[view];
  const back = view === "banca" && !renew ? { label: "Cambia modo", to: "scelta" as const } : view === "trade-republic" ? { label: "Tutte le banche", to: "banca" as const } : null;
  return (
    <>
      <PanelDialogHeader className="pr-10" icon={view === "manuale" ? PencilLineIcon : LandmarkIcon} title={renew ? tr("Rinnova il collegamento") : copy.title} description={renew && view === "banca" ? tr("Scegli di nuovo la tua banca per rinnovare il consenso.") : copy.description} />
      {back ? (
        <button type="button" onClick={() => setView(back.to)} className="-mt-2 inline-flex min-h-11 w-fit cursor-pointer items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground sm:min-h-9">
          <ArrowLeftIcon className="size-4" aria-hidden="true" />{" "}{tr(back.label)}
        </button>
      ) : null}
      {view === "scelta" ? (
        <div className="flex flex-col gap-3">
          <button type="button" className={CHOICE_CLASS} onClick={() => go("banca")}>
            <ChoiceBody icon={ZapIcon} color="var(--primary)" title={tr("Collega la tua banca")} description={blockedReason ? tr("Trade Republic, con le altre banche in arrivo.") : tr("Saldi e movimenti arrivano da soli dalla banca.")} />
          </button>
          <button type="button" className={CHOICE_CLASS} onClick={() => go("manuale")}>
            <ChoiceBody icon={PencilLineIcon} color="var(--swatch-indigo)" title={tr("Conto manuale")} description={tr("Per contanti, carte prepagate o qualsiasi banca: il saldo segue i movimenti che aggiungi.")} />
          </button>
          <Link href="/importazioni" className={CHOICE_CLASS} onClick={() => { track("account_add_path_chosen", { path: "importa" }); onClose(); }}>
            <ChoiceBody icon={FileSpreadsheetIcon} color="var(--swatch-amber)" title={tr("Importa un file CSV o Excel")} description={tr("Carica l'estratto conto: lo leggiamo e crei il conto con i suoi movimenti.")} />
          </Link>
        </div>
      ) : null}
      {view === "banca" ? (
        <BankPicker
          blockedReason={blockedReason}
          interested={capacity?.interested ?? false}
          canRequest={!selfHosted}
          renew={renew}
          onChooseTradeRepublic={chooseTradeRepublic}
          onChooseManual={() => setView("manuale")}
          onImport={() => { track("account_add_path_chosen", { path: "importa" }); onClose(); }}
        />
      ) : null}
      {view === "trade-republic" ? <ConnectTradeRepublic onDone={onClose} /> : null}
      {view === "manuale" ? <AddAccountForm currency={currency} onSuccess={onClose} onExit={() => setView("scelta")} /> : null}
    </>
  );
}
