"use client";

/**
 * «Nella tua casella»: le email che arriveranno con le scelte fatte, come righe di una casella di posta che entrano ed
 * escono mentre si accendono gli interruttori. Senza nessuna scelta dice che non arriverà niente.
 */

import { Inbox } from "lucide-react";
import { AnimatedList } from "@/components/motion";
import type { NotificationPreferences } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { inboxPreview } from "./notification-choices.data";

export interface InboxPreviewProps {
  preferences: NotificationPreferences;
  /** Titolo del riquadro. */
  title?: string;
  /** Testo quando non è attivo niente. */
  emptyText?: string;
  className?: string;
}

export function InboxPreview({
  preferences,
  title = "Nella tua casella",
  emptyText = "Nessuna email facoltativa. Puoi attivarle quando vuoi in Impostazioni.",
  className,
}: InboxPreviewProps) {
  const items = inboxPreview(preferences);
  return (
    <div className={cn("flex flex-col gap-2 rounded-xl border border-border bg-card p-3.5", className)} aria-live="polite">
      <span className="flex items-center gap-1.5 text-xs font-medium text-text-3">
        <Inbox className="size-3.5" aria-hidden="true" />
        {title}
      </span>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <AnimatedList
          ariaLabel={title}
          className="gap-1.5"
          itemClassName="flex items-baseline justify-between gap-3 border-t border-border pt-1.5 text-xs first:border-t-0 first:pt-0"
          items={items.map((item) => ({
            key: item.kind,
            content: (
              <>
                <span className="font-medium text-foreground">{item.title}</span>
                <span className="text-right text-muted-foreground">{item.when}</span>
              </>
            ),
          }))}
        />
      )}
    </div>
  );
}
