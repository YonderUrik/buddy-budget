"use client";

import * as React from "react";
import { buttonVariants } from "@/components/ui/button";

export interface BankReturnCardProps {
  /** App address to open (`buddybudget://bank/return?…`). */
  href: string;
  title: string;
  message: string;
  actionLabel: string;
  /** Try to open the app once on load (the button stays for browsers that block it without a tap). */
  autoOpen?: boolean;
}

/** Card of the page that hands the browser back to the native app after bank consent. */
export function BankReturnCard({ href, title, message, actionLabel, autoOpen = true }: BankReturnCardProps) {
  React.useEffect(() => {
    if (autoOpen) window.location.replace(href);
  }, [autoOpen, href]);

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-card p-6">
      <h1 className="font-display text-3xl">{title}</h1>
      <p className="text-text-2">{message}</p>
      <a className={buttonVariants({ className: "h-11" })} href={href}>
        {actionLabel}
      </a>
    </div>
  );
}
