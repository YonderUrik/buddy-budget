"use client";
import { useLocalization } from "@/lib/localization/provider";

/** Small «Usa l'AI» tag next to a setting whose effect sends data to an AI model; settings without it never do. */

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function AiBadge({ className }: { className?: string }) {
  const { t: tr } = useLocalization();
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary", className)}>
      <Sparkles className="size-3" aria-hidden="true" />
      {tr("Usa l'AI")}
    </span>
  );
}
