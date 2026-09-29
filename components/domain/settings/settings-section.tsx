/** Sezione della pagina Impostazioni: titolo, descrizione opzionale e contenuto in una card. */

import { cn } from "@/lib/utils";

export interface SettingsSectionProps {
  title: string;
  description?: React.ReactNode;
  /** Id del titolo, per collegarlo alla sezione (`aria-labelledby`). */
  id: string;
  /** Variante "danger" per la zona pericolosa (bordo e titolo rossi). */
  tone?: "default" | "danger";
  children: React.ReactNode;
}

export function SettingsSection({ title, description, id, tone = "default", children }: SettingsSectionProps) {
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 sm:p-5",
        tone === "danger" ? "ring-neg/40" : "ring-foreground/10"
      )}
    >
      <header className="flex flex-col gap-1">
        <h2 id={id} className={cn("font-heading text-lg font-medium", tone === "danger" ? "text-neg" : "text-foreground")}>
          {title}
        </h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </header>
      {children}
    </section>
  );
}

/** Riga etichetta + contenuto dentro una sezione (su mobile si impila). */
export function SettingsRow({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4 first:border-t-0 first:pt-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="flex min-w-0 flex-col gap-0.5 sm:max-w-[55%]">
        <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
          {label}
        </label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="flex min-w-0 flex-col gap-1 sm:items-end">{children}</div>
    </div>
  );
}
