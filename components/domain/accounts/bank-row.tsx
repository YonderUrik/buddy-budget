"use client";

/**
 * One bank in the «Collega la tua banca» list: logo, name, a short detail and a trailing slot (arrow, spinner, button).
 * Rendered as a button when `onSelect` is given, as a plain row otherwise (e.g. «Altre banche · In arrivo»).
 */

import * as React from "react";
import { Building2, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const BANK_ROW_CLASS = "flex min-h-16 w-full items-center gap-3 rounded-xl bg-muted/50 px-3.5 py-2.5 text-left";
const INTERACTIVE_CLASS = "cursor-pointer transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60";

export interface BankRowProps {
  logo: React.ReactNode;
  name: string;
  detail?: React.ReactNode;
  /** Small pill after the name («In arrivo»). */
  badge?: string;
  /** Replaces the arrow; `null` hides it. */
  trailing?: React.ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  /** Greys out the name and detail for a bank that cannot be chosen yet. */
  muted?: boolean;
  /** Extra content under the row text (a button, a confirmation). */
  children?: React.ReactNode;
}

export function BankRow({ logo, name, detail, badge, trailing, onSelect, disabled, muted = false, children }: BankRowProps) {
  const body = (
    <>
      {logo}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-semibold", muted ? "text-text-2" : "text-foreground")}>
          <span className="break-words">{name}</span>
          {badge ? <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">{badge}</span> : null}
        </span>
        {detail ? <span className="text-xs text-muted-foreground">{detail}</span> : null}
        {children}
      </span>
      {trailing === undefined ? (onSelect ? <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : null) : trailing}
    </>
  );
  if (!onSelect) return <div className={BANK_ROW_CLASS}>{body}</div>;
  return <button type="button" onClick={onSelect} disabled={disabled} className={cn(BANK_ROW_CLASS, INTERACTIVE_CLASS)}>{body}</button>;
}

/** Round placeholder used when a bank has no logo. */
export function GenericBankLogo({ muted = false }: { muted?: boolean }) {
  return (
    <span className={cn("grid size-10 shrink-0 place-items-center rounded-full bg-background text-muted-foreground", muted && "opacity-70")} aria-hidden="true">
      <Building2 className="size-4" />
    </span>
  );
}

/** Trade Republic's mark as a monogram (no external asset): dark round tile with «TR». */
export function TradeRepublicLogo() {
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-foreground text-[0.7rem] font-bold tracking-tight text-background" aria-hidden="true">
      TR
    </span>
  );
}
