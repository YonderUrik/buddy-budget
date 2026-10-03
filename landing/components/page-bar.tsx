import "./legal-page.css";
import Link from "next/link";
import type { ReactNode } from "react";
import { Mark } from "./brand";
import { ThemeToggle } from "./theme-toggle";

export interface PageBarLink {
  href: string;
  label: string;
}

/** Barra in alto delle pagine secondarie (contenuti e documenti legali): marchio, voci di sezione, cambio tema e un'azione opzionale. */
export function PageBar({ links, current, label, action }: { links: readonly PageBarLink[]; current?: string; label: string; action?: ReactNode }) {
  return (
    <header className="legal-bar">
      <div className="wrap">
        <Link href="/" className="legal-brand" aria-label="BuddyBudget, torna alla home">
          <Mark />
          <span>BuddyBudget</span>
        </Link>
        <nav aria-label={label}>
          {links.map((l) => (
            <Link key={l.href} href={l.href} aria-current={l.href === current ? "page" : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="legal-actions">
          <ThemeToggle />
          {action}
        </div>
      </div>
    </header>
  );
}
