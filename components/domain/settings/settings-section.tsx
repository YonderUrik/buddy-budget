"use client";
import { useLocalization } from "@/lib/localization/provider";
/** Sezione della pagina Impostazioni: icona colorata, titolo, descrizione opzionale, anteprima opzionale e contenuto, senza riquadro. */

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { AiBadge } from "./ai-badge";

export interface SettingsSectionProps {
  title: string;
  description?: React.ReactNode;
  /** Id del titolo, per collegarlo alla sezione (`aria-labelledby`). */
  id: string;
  /** Icona nel riquadro colorato accanto al titolo. */
  icon?: LucideIcon;
  /** Anteprima di ciò che le opzioni cambiano (vedi `SettingsPreview`), sopra le opzioni. */
  preview?: React.ReactNode;
  /** Variante "danger" per la zona pericolosa (icona e titolo rossi). */
  tone?: "default" | "danger";
  children: React.ReactNode;
}

export function SettingsSection({ title, description, id, icon: Icon, preview, tone = "default", children }: SettingsSectionProps) {
  const { t: tr } = useLocalization();
  const danger = tone === "danger";
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <header className="flex items-start gap-3">
        {Icon ? (
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", danger ? "bg-neg-soft text-neg" : "bg-primary/10 text-primary")}>
            <Icon className="size-[18px]" aria-hidden="true" />
          </span>
        ) : null}
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 id={id} className={cn("font-heading text-base font-medium", danger ? "text-neg" : "text-foreground")}>
            {tr(title)}
          </h3>
          {description && <p className="text-sm text-muted-foreground">{tr(description)}</p>}
        </div>
      </header>
      {preview}
      {children}
    </section>
  );
}

/** Label + content row inside a section (stacked on mobile); `ai` adds the «Usa l'AI» tag next to the label. */
export function SettingsRow({
  label,
  hint,
  children,
  htmlFor,
  ai,
  className,
}: {
  label: string;
  hint?: React.ReactNode;
  htmlFor?: string;
  /** The setting sends data to an AI model when on. */
  ai?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const { t: tr } = useLocalization();
  return (
    <div className={cn("flex flex-col gap-2 border-t border-border pt-4 first:border-t-0 first:pt-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6", className)}>
      <div className="flex min-w-0 flex-col gap-0.5 sm:max-w-[55%]">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
            {tr(label)}
          </label>
          {ai ? <AiBadge /> : null}
        </div>
        {hint && <p className="text-xs text-muted-foreground">{tr(hint)}</p>}
      </div>
      <div className="flex min-w-0 flex-col gap-1 sm:items-end">{children}</div>
    </div>
  );
}
