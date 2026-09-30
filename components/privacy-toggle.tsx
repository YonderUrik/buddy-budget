"use client";

import { Eye, EyeOff } from "lucide-react";
import { usePrivacy } from "@/components/privacy-provider";
import { cn } from "@/lib/utils";

interface PrivacyToggleProps {
  /** Classi aggiuntive per il bottone. */
  className?: string;
}

/** Pulsante globale per nascondere o mostrare tutti gli importi dell'app; pensato per superfici `--sidebar`. */
export function PrivacyToggle({ className }: PrivacyToggleProps) {
  const { hidden, toggle } = usePrivacy();
  const Icon = hidden ? EyeOff : Eye;
  const label = hidden ? "Mostra gli importi" : "Nascondi gli importi";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={hidden}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-8 items-center justify-center rounded-lg text-sidebar-foreground/70",
        "transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        className
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}
