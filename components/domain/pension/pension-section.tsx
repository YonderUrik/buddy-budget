/** Sezione aperta di Pensione, nello stile della Panoramica: titolo con icona tinta, una riga di spiegazione e il contenuto senza riquadro. */

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { SectionTitle } from "@/components/domain/liquidity";
import { InfoHint } from "@/components/domain/shared";
import { cn } from "@/lib/utils";

export interface PensionSectionProps {
  icon: LucideIcon;
  title: string;
  /** Token CSS del colore dell'ambito (es. `var(--swatch-teal)`): tinge l'icona e il suo fondo. */
  color: string;
  /** Riga sotto il titolo: cosa mostra la sezione. */
  description?: ReactNode;
  /** Spiegazione lunga, in un popover accanto alla descrizione. */
  hint?: { label: string; text: string };
  children: ReactNode;
  className?: string;
}

export function PensionSection({ icon, title, color, description, hint, children, className }: PensionSectionProps) {
  return (
    <section aria-label={title} className={cn("flex flex-col", className)}>
      <SectionTitle icon={icon} title={title} color={color} />
      {description || hint ? (
        <p className="-mt-1 mb-4 text-sm text-text-2">
          {description}
          {hint ? (
            <>
              {" "}
              <InfoHint label={hint.label}>{hint.text}</InfoHint>
            </>
          ) : null}
        </p>
      ) : null}
      {children}
    </section>
  );
}
