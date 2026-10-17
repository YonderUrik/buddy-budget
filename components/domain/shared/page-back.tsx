"use client";

/**
 * The app's «‹» back button, mounted once in the layout instead of on each page: on the phone in the top bar (fixed,
 * large touch target, like a native app), on desktop in a row above the page. It leads to the screen the user came
 * from (also between main sections), or to the logical parent of a second-level page when there is no known previous
 * screen; a main section opened directly shows no button. See `lib/navigation`.
 */

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";
import { track } from "@/lib/analytics";
import { useLocalization } from "@/lib/localization/provider";
import { pathOf, useBackTarget, type BackTarget } from "@/lib/navigation";

/** First segment of an address, as the categorical props of the Umami event. */
function sectionOf(path: string): string {
  return path.split("/")[1] || "home";
}

function useCurrentHref(): string {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  return search ? `${pathname}?${search}` : pathname;
}

function BackButton({ target, from, place, className, iconClassName }: { target: BackTarget; from: string; place: "barra" | "pagina"; className: string; iconClassName: string }) {
  const { t: tr } = useLocalization();
  const label = tr(target.label);
  return (
    <Link
      href={target.href}
      className={className}
      data-topbar-back={place === "barra" ? "" : undefined}
      aria-label={tr("Indietro: {0}", { 0: label })}
      onClick={() => track("back_link_clicked", { section: sectionOf(pathOf(from)), target: target.source === "previous" ? "precedente" : "madre", to: sectionOf(pathOf(target.href)), place })}
    >
      <ChevronLeftIcon className={iconClassName} aria-hidden="true" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function TopBarBackInner({ fallback }: { fallback: React.ReactNode }) {
  const href = useCurrentHref();
  const target = useBackTarget(href);
  if (!target) return <>{fallback}</>;
  return (
    <BackButton
      target={target}
      from={href}
      place="barra"
      className="-ml-2 flex min-h-11 min-w-11 max-w-[70vw] items-center gap-0.5 rounded-lg pr-2 text-base font-medium text-sidebar-foreground transition-colors active:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      iconClassName="size-7 shrink-0"
    />
  );
}

/** Back button for the phone top bar; `fallback` (e.g. the brand) is shown when there is nowhere to go back to. */
export function TopBarBack({ fallback = null }: { fallback?: React.ReactNode }) {
  return (
    <React.Suspense fallback={fallback}>
      <TopBarBackInner fallback={fallback} />
    </React.Suspense>
  );
}

function PageBackBarInner() {
  const href = useCurrentHref();
  const target = useBackTarget(href);
  if (!target) return null;
  return (
    <div className="mx-auto -mb-4 max-w-6xl px-4 pt-3 sm:px-6 max-md:hidden">
      <BackButton
        target={target}
        from={href}
        place="pagina"
        className="-ml-2 inline-flex min-h-10 max-w-full items-center gap-1 rounded-lg px-2 text-sm font-medium text-text-2 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        iconClassName="size-5 shrink-0"
      />
    </div>
  );
}

/** Back button above the page on desktop (hidden on the phone, where the top bar has it). */
export function PageBackBar() {
  return (
    <React.Suspense fallback={null}>
      <PageBackBarInner />
    </React.Suspense>
  );
}
