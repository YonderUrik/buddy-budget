"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * Scelta delle email facoltative (riepilogo, avvisi su budget e scadenze) come righe con interruttore, pensata per
 * l'onboarding. Controllata: legge e scrive le stesse `NotificationPreferences` della sezione Notifiche di Impostazioni.
 * Accendere una riga fa «saltare» la sua icona; la frequenza del riepilogo compare sotto la riga solo quando serve.
 */

import { AnimatePresence, motion } from "motion/react";
import { CalendarClock, CalendarRange, PieChart, type LucideIcon } from "lucide-react";
import { SegmentedControl } from "@/components/domain/shared";
import { Switch } from "@/components/ui/switch";
import { NOTIFICATION_KIND_INFO, type NotificationKind, type NotificationPreferences } from "@/lib/notifications";
import { SPRING_BOUNCY, SPRING_SOFT } from "@/lib/motion/springs";
import { cn } from "@/lib/utils";
import { DIGEST_FREQUENCY_OPTIONS, NOTIFICATION_CHOICE_KINDS, PREFERENCE_FIELD_BY_KIND } from "./notification-choices.data";

const ICON_BY_KIND: Record<NotificationKind, LucideIcon> = { digest: CalendarRange, budget: PieChart, deadlines: CalendarClock };
/** Ritardo tra l'ingresso di una riga e la successiva, in secondi. */
const ROW_STAGGER_S = 0.06;

export interface NotificationChoicesProps {
  value: NotificationPreferences;
  onChange: (value: NotificationPreferences) => void;
  /** Chiamata dopo ogni interruttore, per il tracciamento. */
  onToggle?: (kind: NotificationKind, enabled: boolean) => void;
  disabled?: boolean;
  /** Testi delle righe; di default quelli della sezione Notifiche. */
  info?: Record<NotificationKind, { label: string; hint: string }>;
  className?: string;
}

export function NotificationChoices({ value, onChange, onToggle, disabled = false, info = NOTIFICATION_KIND_INFO, className }: NotificationChoicesProps) {
  const { t: tr } = useLocalization();
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {NOTIFICATION_CHOICE_KINDS.map((kind, index) => {
        const field = PREFERENCE_FIELD_BY_KIND[kind];
        const checked = value[field];
        const Icon = ICON_BY_KIND[kind];
        // Sfondo pieno: le righe stanno sopra la griglia del foglio delle pagine di accesso e non devono lasciarla trasparire.
        return (
          <motion.div
            key={kind}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING_SOFT, delay: index * ROW_STAGGER_S }}
            className={cn(
              "rounded-xl border transition-colors",
              checked ? "border-primary/40 bg-[color-mix(in_oklab,var(--primary)_6%,var(--card))]" : "border-border bg-card"
            )}
          >
            <label htmlFor={`onboarding-notifiche-${kind}`} className="flex cursor-pointer items-center gap-3 p-3.5">
              <motion.span
                key={String(checked)}
                initial={checked ? { scale: 0.7, rotate: -12 } : false}
                animate={{ scale: 1, rotate: 0 }}
                transition={SPRING_BOUNCY}
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors",
                  checked ? "bg-primary/10 text-primary" : "bg-muted text-text-3"
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
              </motion.span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">{tr(info[kind].label)}</span>
                <span className="text-xs text-muted-foreground">{tr(info[kind].hint)}</span>
              </span>
              <Switch
                id={`onboarding-notifiche-${kind}`}
                checked={checked}
                disabled={disabled}
                onCheckedChange={(enabled) => {
                  onChange({ ...value, [field]: enabled });
                  onToggle?.(kind, enabled);
                }}
                aria-label={tr(info[kind].label)}
              />
            </label>
            {kind === "digest" && (
              <AnimatePresence initial={false}>
                {checked && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={SPRING_SOFT}
                    className="overflow-hidden"
                  >
                    <div className="px-3.5 pb-3.5">
                      <SegmentedControl
                        options={DIGEST_FREQUENCY_OPTIONS}
                        value={value.digestFrequency}
                        onChange={(digestFrequency) => onChange({ ...value, digestFrequency })}
                        ariaLabel={tr("Ogni quanto ricevere il riepilogo")}
                        stretch
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
