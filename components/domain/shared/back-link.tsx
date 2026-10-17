"use client";

/**
 * Back to the previous page, the same everywhere in the app: «‹» arrow and the name of the page it leads to, above the
 * title, with a 44 px touch target. With `href` it is a link: it goes to the page the user came from when that is a
 * known app page (e.g. «‹ Operazioni» on a security opened from Operazioni), otherwise to `href`, the logical parent
 * page named by `label` (first visit, link from an email). With `onClick` it is a button (e.g. from a Settings group
 * back to the list, which lives on the same page).
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";
import { track } from "@/lib/analytics";
import { useLocalization } from "@/lib/localization/provider";
import { pathOf, useBackTarget } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const BACK_LINK_CLASS =
  "-ml-2 inline-flex min-h-11 w-fit items-center gap-1 rounded-lg px-2 text-sm font-medium text-text-2 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export type BackLinkProps = {
  /** Name of the parent page (e.g. «Liquidità»), shown when the previous page is unknown. */
  label: string;
  className?: string;
} & (
  | {
      href: string;
      onClick?: never;
      /** `false`: always the parent page, even when the user came from somewhere else (default `true`). */
      followHistory?: boolean;
    }
  | { onClick: () => void; href?: never; followHistory?: never }
);

/** First segment of the current address, as the categorical `section` of the Umami event. */
function sectionOf(path: string): string {
  return path.split("/")[1] || "home";
}

function BackLinkContent({ label }: { label: string }) {
  return (
    <>
      <ChevronLeftIcon className="size-4 shrink-0" aria-hidden="true" />
      {label}
    </>
  );
}

function HistoryBackLink({ href, label, className, followHistory }: { href: string; label: string; className?: string; followHistory: boolean }) {
  const { t: tr } = useLocalization();
  const pathname = usePathname();
  const historyTarget = useBackTarget(pathname, { href, label });
  const target = followHistory ? historyTarget : { href, label, source: "parent" as const };
  return (
    <Link
      href={target.href}
      className={cn(BACK_LINK_CLASS, className)}
      onClick={() => track("back_link_clicked", { section: sectionOf(pathname), target: target.source === "previous" ? "precedente" : "madre", to: sectionOf(pathOf(target.href)) })}
    >
      <BackLinkContent label={tr(target.label)} />
    </Link>
  );
}

export function BackLink({ label, href, onClick, className, followHistory = true }: BackLinkProps) {
  const { t: tr } = useLocalization();
  if (href !== undefined) return <HistoryBackLink href={href} label={label} className={className} followHistory={followHistory} />;
  return (
    <button type="button" onClick={onClick} className={cn(BACK_LINK_CLASS, className)}>
      <BackLinkContent label={tr(label)} />
    </button>
  );
}
