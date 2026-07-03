"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    // Necessario per evitare mismatch di idratazione: il tema risolto
    // è noto solo lato client (next-themes legge localStorage/preferenze OS).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <div className="flex items-center gap-2">
      <Sun className="size-4 text-muted-foreground" />
      <Switch
        id="theme-toggle"
        checked={isDark}
        onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
      />
      <Moon className="size-4 text-muted-foreground" />
      <Label htmlFor="theme-toggle" className="sr-only">
        Attiva tema scuro
      </Label>
    </div>
  );
}
