/** Interruttore Categorie | Regole della scheda "Categorie e regole": due pagine vere, link con stato attivo. */

import Link from "next/link";
import { cn } from "@/lib/utils";

export interface ManagementSwitchOption {
  href: string;
  label: string;
}

export interface ManagementSwitchProps {
  options: readonly ManagementSwitchOption[];
  activeHref: string;
  ariaLabel?: string;
}

export function ManagementSwitch({ options, activeHref, ariaLabel = "Categorie o regole" }: ManagementSwitchProps) {
  return (
    <nav aria-label={ariaLabel} className="inline-flex w-fit rounded-full bg-muted p-1">
      {options.map((option) => {
        const active = option.href === activeHref;
        return (
          <Link
            key={option.href}
            href={option.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center rounded-full px-5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-ring",
              active ? "bg-card text-foreground shadow-xs" : "text-text-2 hover:text-foreground",
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </nav>
  );
}
