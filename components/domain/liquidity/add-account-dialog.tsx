"use client";

/**
 * Dialog «Nuovo conto»: parte da una scelta (collega la banca, conto manuale, importa un file) e porta al passo giusto,
 * con «Indietro» sempre disponibile. A tutto schermo sul telefono. `renew` apre direttamente il collegamento della banca.
 */

import Link from "next/link";
import * as React from "react";
import { ArrowLeftIcon, ChevronRightIcon, FileSpreadsheetIcon, LandmarkIcon, PencilLineIcon, ZapIcon } from "lucide-react";
import { AddAccountForm, ConnectBankFlow } from "@/components/domain/accounts";
import { PanelDialogHeader } from "@/components/domain/investments";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { DialogCloseButton } from "./dialog-close-button";
import { LIQUIDITY_DIALOG_CLASS } from "./dialog-layout";

export type AddAccountView = "scelta" | "banca" | "manuale";

const VIEW_COPY: Record<AddAccountView, { title: string; description: string }> = {
  scelta: { title: "Nuovo conto", description: "Come vuoi tenere aggiornato questo conto?" },
  banca: { title: "Collega la tua banca", description: "Scegli la banca: saldi e movimenti arrivano da soli." },
  manuale: { title: "Conto manuale", description: "Aggiorni tu saldo e movimenti, quando vuoi." },
};

interface ChoiceProps {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  title: string;
  description: string;
  badge?: string;
}

function ChoiceBody({ icon: Icon, color, title, description, badge }: ChoiceProps) {
  return (
    <>
      <span className="grid size-11 shrink-0 place-items-center rounded-full" style={{ color, backgroundColor: `color-mix(in oklab, ${color} 16%, transparent)` }} aria-hidden="true">
        <Icon className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {title}
          {badge ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{badge}</span> : null}
        </span>
        <span className="text-sm text-muted-foreground">{description}</span>
      </span>
      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </>
  );
}

const CHOICE_CLASS = "flex min-h-[4.5rem] w-full cursor-pointer items-center gap-3.5 rounded-xl border bg-background p-3.5 text-left transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

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
      <DialogContent className={cn(LIQUIDITY_DIALOG_CLASS)}>
        {open ? <AddAccountSession key={renew ? "rinnovo" : "nuovo"} currency={currency} renew={renew} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function AddAccountSession({ currency, renew, onClose }: { currency: string; renew: boolean; onClose: () => void }) {
  const [view, setView] = React.useState<AddAccountView>(renew ? "banca" : "scelta");
  const copy = VIEW_COPY[view];
  const go = (next: "banca" | "manuale") => {
    track("account_add_path_chosen", { path: next });
    setView(next);
  };
  return (
    <>
      <DialogCloseButton />
      <PanelDialogHeader className="pr-10" icon={view === "manuale" ? PencilLineIcon : LandmarkIcon} title={renew ? "Rinnova il collegamento" : copy.title} description={renew && view === "banca" ? "Scegli di nuovo la tua banca per rinnovare il consenso." : copy.description} />
      {view === "scelta" ? (
        <div className="flex flex-col gap-3">
          <button type="button" className={CHOICE_CLASS} onClick={() => go("banca")}>
            <ChoiceBody icon={ZapIcon} color="var(--primary)" title="Collega la tua banca" badge="Automatico" description="Saldi e movimenti si aggiornano da soli, in sola lettura." />
          </button>
          <button type="button" className={CHOICE_CLASS} onClick={() => go("manuale")}>
            <ChoiceBody icon={PencilLineIcon} color="var(--swatch-indigo)" title="Conto manuale" description="Per contanti, carte prepagate o banche che non si collegano." />
          </button>
          <Link href="/importazioni" className={CHOICE_CLASS} onClick={() => { track("account_add_path_chosen", { path: "importa" }); onClose(); }}>
            <ChoiceBody icon={FileSpreadsheetIcon} color="var(--swatch-amber)" title="Importa un file CSV o Excel" description="Carica l'estratto conto: lo leggiamo e crei il conto con i suoi movimenti." />
          </Link>
        </div>
      ) : (
        <button type="button" onClick={() => setView("scelta")} className="-mt-2 inline-flex min-h-11 w-fit cursor-pointer items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground sm:min-h-9">
          <ArrowLeftIcon className="size-4" aria-hidden="true" /> Cambia modo
        </button>
      )}
      {view === "banca" ? <ConnectBankFlow onChooseManual={() => setView("manuale")} /> : null}
      {view === "manuale" ? <AddAccountForm currency={currency} onSuccess={onClose} /> : null}
    </>
  );
}
