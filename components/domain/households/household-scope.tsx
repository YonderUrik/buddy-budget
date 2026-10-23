"use client";

/**
 * Panoramica with groups: the «Io · Noi due · …» switch above the page, the viewer's own Panoramica under «Io» and the
 * group view under a group. The choice is in `?group=` (shareable, survives a reload); without groups only the
 * viewer's page shows, unchanged. `?joined=1` (after accepting an invitation) says so once.
 */

import * as React from "react";
import { toast } from "sonner";
import { LoadError } from "@/components/domain/shared";
import { track } from "@/lib/analytics";
import { useLocalization } from "@/lib/localization/provider";
import { useHouseholdOverviewQuery, useHouseholdsQuery } from "@/lib/queries/households";
import { HouseholdOverviewView } from "./household-overview";
import { HouseholdViewSwitch, OWN_VIEW } from "./household-view-switch";

/** Query parameter holding the chosen group. */
export const GROUP_PARAM = "group";
const JOINED_PARAM = "joined";

export interface HouseholdScopeProps {
  currency: string;
  /** The viewer's own Panoramica. */
  children: React.ReactNode;
}

/** The address never changes under the page except through `replaceParams`, which the page itself calls. */
const subscribeNever = () => () => {};

function replaceParams(update: (params: URLSearchParams) => void) {
  const params = new URLSearchParams(window.location.search);
  update(params);
  const query = params.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
}

export function HouseholdScope({ currency, children }: HouseholdScopeProps) {
  const { t: tr } = useLocalization();
  const groupsQuery = useHouseholdsQuery();
  const groups = React.useMemo(() => groupsQuery.data ?? [], [groupsQuery.data]);
  // The address is read after hydration (the server renders «Io»); the user's choice then wins over it.
  const search = React.useSyncExternalStore(subscribeNever, () => window.location.search, () => "");
  const params = new URLSearchParams(search);
  const [chosen, setChosen] = React.useState<string | null>(null);
  const view = chosen ?? params.get(GROUP_PARAM) ?? OWN_VIEW;
  const joinedInUrl = params.has(JOINED_PARAM);
  const joinedShown = React.useRef(false);

  React.useEffect(() => {
    if (!joinedInUrl || joinedShown.current || groups.length === 0) return;
    joinedShown.current = true;
    replaceParams((p) => p.delete(JOINED_PARAM));
    const group = groups.find((g) => g.id === view);
    if (group) toast.success(tr("Sei in «{0}»", { 0: group.name }));
  }, [joinedInUrl, groups, view, tr]);

  const known = view === OWN_VIEW || groups.some((g) => g.id === view);
  const groupId = view !== OWN_VIEW && known ? view : null;
  const overviewQuery = useHouseholdOverviewQuery(groupId, new Date().toISOString().slice(0, 7));

  function change(next: string) {
    setChosen(next);
    replaceParams((p) => (next === OWN_VIEW ? p.delete(GROUP_PARAM) : p.set(GROUP_PARAM, next)));
    track("household_view_opened", { view: next === OWN_VIEW ? "io" : "gruppo" });
  }

  if (groups.length === 0) {
    // A group in the address while the list is still loading: hold the page instead of flashing the own view.
    return view !== OWN_VIEW && groupsQuery.isLoading ? <div className="h-96 animate-pulse rounded-3xl bg-muted" aria-busy="true" /> : <>{children}</>;
  }
  return (
    <>
      <HouseholdViewSwitch groups={groups} value={known ? view : OWN_VIEW} onChange={change} />
      {groupId === null ? (
        children
      ) : overviewQuery.isError ? (
        <LoadError message={tr("Impossibile caricare il gruppo")} onRetry={() => overviewQuery.refetch()} />
      ) : !overviewQuery.data ? (
        <div className="flex flex-col gap-6" aria-busy="true">
          <div className="h-40 animate-pulse rounded-3xl bg-muted" />
          <div className="h-36 animate-pulse rounded-3xl bg-muted" />
          <div className="h-72 animate-pulse rounded-3xl bg-muted" />
        </div>
      ) : (
        <HouseholdOverviewView overview={overviewQuery.data} currency={currency} />
      )}
    </>
  );
}
