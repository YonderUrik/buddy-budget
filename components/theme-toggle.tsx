"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------

interface ThemeToggleProps {
  /**
   * Modalità compatta: mostra solo l'icona attiva (☀ o ☾) come bottone.
   * Usata nella sidebar compressa dove non c'è spazio per Switch + due icone.
   * Default: false (mostra ☀ + Switch + ☾).
   */
  compact?: boolean;
  /**
   * Superficie su cui il toggle è montato: determina quali token di colore usare
   * per restare leggibile. `"app"` (default) per sfondo `--background`/`--card`;
   * `"sidebar"` per sfondo `--sidebar`.
   */
  surface?: "app" | "sidebar";
  /** Classi CSS aggiuntive per il wrapper esterno. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function ThemeToggle({ compact = false, surface = "app", className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    // Necessario per evitare mismatch di idratazione: il tema risolto
    // è noto solo lato client (next-themes legge localStorage/preferenze OS).
    setMounted(true);
  }, []);

  if (!mounted) {
    // Placeholder a larghezza fissa per evitare layout shift all'idratazione.
    return <div className={cn(compact ? "size-8" : "h-5 w-[68px]", className)} />;
  }

  const isDark = resolvedTheme === "dark";
  const toggle = () => setTheme(isDark ? "light" : "dark");

  // Su --sidebar usa i token sidebar dedicati invece dei token app (--muted-foreground/--foreground),
  // così il contrasto resta corretto anche se le due superfici divergono.
  const iconClass =
    surface === "sidebar" ? "text-sidebar-foreground/70" : "text-muted-foreground";
  const iconHoverClass =
    surface === "sidebar" ? "hover:text-sidebar-accent-foreground" : "hover:text-foreground";

  // ── Variante compatta: solo l'icona attiva, cliccabile ──
  if (compact) {
    const Icon = isDark ? Moon : Sun;
    return (
      <button
        onClick={toggle}
        className={cn(
          "flex size-8 items-center justify-center rounded-lg",
          iconClass,
          iconHoverClass,
          "hover:bg-sidebar-accent transition-colors duration-150",
          className
        )}
        aria-label={isDark ? "Passa al tema chiaro" : "Passa al tema scuro"}
        title={isDark ? "Passa al tema chiaro" : "Passa al tema scuro"}
      >
        <Icon className="size-4" aria-hidden="true" />
      </button>
    );
  }

  // ── Variante standard: ☀ + Switch + ☾ ──
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Sun className={cn("size-4", iconClass)} aria-hidden="true" />
      <Switch
        id="theme-toggle"
        checked={isDark}
        onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
      />
      <Moon className={cn("size-4", iconClass)} aria-hidden="true" />
      <Label htmlFor="theme-toggle" className="sr-only">
        Attiva tema scuro
      </Label>
    </div>
  );
}
