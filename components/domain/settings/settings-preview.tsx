"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * Anteprime per la pagina Impostazioni: piccoli disegni, costruiti con i token del tema (seguono chiaro e scuro), che
 * mostrano che cosa cambia attivando un'opzione. Non sono schermate vere: servono a capire a colpo d'occhio.
 */

import * as React from "react";
import { Check, LayoutDashboard, Sparkles, TrendingUp, Wallet } from "lucide-react";

import { useBottomNav, useSidebarModule } from "@/lib/hooks/use-sidebar-preferences";
import { SIDEBAR_MODULES, type SidebarModuleId } from "@/lib/sidebar/modules";
import { cn } from "@/lib/utils";

export interface SettingsPreviewProps {
  /** Didascalia sotto il disegno. */
  caption: string;
  children: React.ReactNode;
  className?: string;
}

/** Cornice di un'anteprima: sfondo tenue, etichetta «Anteprima» e didascalia. Il contenuto è decorativo. */
export function SettingsPreview({ caption, children, className }: SettingsPreviewProps) {
  const { t: tr } = useLocalization();
  return (
    <figure className="m-0 flex flex-col gap-2">
      <div aria-hidden="true" className={cn("relative overflow-hidden rounded-xl bg-muted/60 p-3 sm:p-4", className)}>
        <span className="absolute right-2 top-2 rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-text-3">{tr("Anteprima")}</span>
        {children}
      </div>
      <figcaption className="text-xs text-muted-foreground">{tr(caption)}</figcaption>
    </figure>
  );
}

/** Barretta grigia che fa da testo nei disegni. */
function Bar({ className }: { className?: string }) {
  return <span className={cn("block h-1.5 rounded-full bg-text-3/30", className)} />;
}

function ModuleBlock({ id, label }: { id: SidebarModuleId; label: string }) {
  const { t: tr } = useLocalization();
  const [enabled] = useSidebarModule(id);
  return (
    <div className={cn("rounded-md border border-sidebar-border/60 px-2 py-1.5 transition-opacity", enabled ? "bg-card" : "opacity-30")}>
      <p className="truncate text-[10px] font-medium leading-none text-foreground">{tr(label)}</p>
      <Bar className="mt-1.5 w-2/3" />
    </div>
  );
}

/** Mini barra laterale e mini barra in basso del telefono: i blocchi si spengono davvero con gli interruttori sotto. */
export function SidebarPreview() {
  const { t: tr } = useLocalization();
  const [bottomNav] = useBottomNav();
  return (
    <SettingsPreview caption="A sinistra la barra su computer, a destra il telefono. I blocchi spenti si attenuano; la barra in basso sostituisce il menu a scomparsa.">
      <div className="flex items-stretch gap-4">
        <div className="flex w-40 shrink-0 flex-col gap-1.5 rounded-lg bg-sidebar p-2">
          <div className="flex flex-col gap-1">
            {[LayoutDashboard, Wallet, TrendingUp].map((Icon, i) => (
              <div key={i} className={cn("flex items-center gap-1.5 rounded px-1.5 py-1", i === 0 && "bg-sidebar-accent")}>
                <Icon className="size-3 text-sidebar-foreground" />
                <span className="h-1.5 w-10 rounded-full bg-sidebar-foreground/40" />
              </div>
            ))}
          </div>
          <div className="mt-1 flex flex-col gap-1">
            {SIDEBAR_MODULES.map((m) => (
              <ModuleBlock key={m.id} id={m.id} label={tr(m.label)} />
            ))}
          </div>
        </div>
        <div className="flex min-w-0 flex-1 items-end justify-center">
          <div className="flex h-44 w-24 flex-col overflow-hidden rounded-xl border-2 border-text-3/40 bg-background">
            <div className="flex-1 space-y-1.5 p-2">
              <Bar className="w-1/2" />
              <Bar className="w-full" />
              <Bar className="w-3/4" />
            </div>
            <div className={cn("flex h-7 items-center justify-around bg-sidebar transition-opacity", bottomNav ? "opacity-100" : "opacity-20")}>
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className="size-2 rounded-full bg-sidebar-foreground/60" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </SettingsPreview>
  );
}

/** Mini email di riepilogo: oggetto, tre cifre e una riga di avviso, come le riceverai. */
export function EmailPreview() {
  const { t: tr } = useLocalization();
  return (
    <SettingsPreview caption="Un esempio di cosa ricevi: il riepilogo dell'ultimo periodo e, se li attivi, gli avvisi su budget e scadenze.">
      <div className="mx-auto flex max-w-sm flex-col gap-2 rounded-lg bg-card p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="size-5 rounded-full bg-primary/15" />
          <p className="text-xs font-semibold text-foreground">{tr("Il tuo mese in BuddyBudget")}</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {["Entrate", "Spese", "Risparmio"].map((label, i) => (
            <div key={label} className="rounded-md bg-muted/70 px-2 py-1.5">
              <p className="text-[9px] text-text-3">{tr(label)}</p>
              <span className={cn("mt-1 block h-2 w-3/4 rounded-full", i === 0 ? "bg-pos/50" : i === 1 ? "bg-neg/50" : "bg-primary/40")} />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-md bg-neg-soft px-2 py-1.5">
          <span className="size-1.5 rounded-full bg-neg" />
          <p className="text-[10px] text-foreground">{tr("Hai usato l'80% del budget di una categoria")}</p>
        </div>
      </div>
    </SettingsPreview>
  );
}

/** Mini proposta dell'assistente: un movimento, la categoria suggerita e i pulsanti per confermarla o rifiutarla. */
export function CategoryProposalPreview() {
  const { t: tr } = useLocalization();
  return (
    <SettingsPreview caption="L'assistente propone: quelle in dubbio le scegli tu, quelle quasi certe può metterle l'app da sola, e restano da controllare.">
      <div className="mx-auto flex max-w-sm flex-col gap-2 rounded-lg bg-card p-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-foreground">{tr("Esercente")}</p>
          <Bar className="w-10" />
        </div>
        <div className="flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1.5 text-primary">
          <Sparkles className="size-3.5" />
          <p className="text-[11px] font-medium">{tr("Categoria proposta: Alimentari")}</p>
        </div>
        <div className="flex gap-2">
          <span className="flex flex-1 items-center justify-center gap-1 rounded-md bg-primary py-1 text-[10px] font-medium text-primary-foreground">
            <Check className="size-3" />{tr("Conferma")}</span>
          <span className="flex flex-1 items-center justify-center rounded-md border border-border py-1 text-[10px] font-medium text-text-2">{tr("Cambia")}</span>
        </div>
      </div>
    </SettingsPreview>
  );
}
