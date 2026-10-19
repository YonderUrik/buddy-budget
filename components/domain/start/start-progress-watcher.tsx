"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * Notices when a first step becomes done anywhere in the app and says what comes next: a toast with the next step's
 * action (in Panoramica the next-step block says it instead), or «Primi passi completati» at the end. Each step
 * is announced once per device and counted with `start_step_completed`. Renders nothing; mounted once in the app layout.
 */

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { track } from "@/lib/analytics";
import { useStartQuery } from "@/lib/queries/start";
import { newlyDoneSteps, nextStartStep, startStepDefinitionsFor, type StartStepId } from "@/lib/start";
import { addRecentSteps, clearRecentSteps, readSeenSteps, writeSeenSteps } from "@/lib/start/progress";

/** The page that shows the first steps itself: no toast there for a step, only for the end. */
const OVERVIEW_PATH = "/panoramica";

export function StartProgressWatcher() {
  const { t: tr, features } = useLocalization();
  const status = useStartQuery().data;
  const pathname = usePathname();
  const router = useRouter();

  // The «done» line on the next-step block lasts for one visit to Panoramica.
  React.useEffect(() => {
    if (pathname !== OVERVIEW_PATH) clearRecentSteps();
  }, [pathname]);

  React.useEffect(() => {
    if (!status || status.demoActive) return;
    const doneNow = status.stepIds.filter((id) => status.steps[id]);
    const seen = readSeenSteps();
    writeSeenSteps([...new Set([...(seen ?? []), ...doneNow])]);
    // First visit on this device: what is already done is not news.
    if (seen === null) return;
    const before = Object.fromEntries(seen.map((id) => [id, true])) as Partial<Record<StartStepId, boolean>>;
    const fresh = newlyDoneSteps(before, status.steps, status.stepIds);
    if (fresh.length === 0) return;
    for (const step of fresh) track("start_step_completed", { step });
    if (status.dismissed) return;

    const definitions = startStepDefinitionsFor({ retirementAvailable: features.retirement });
    const doneText = fresh.map((id) => tr(definitions.find((d) => d.id === id)?.done ?? "")).join(" · ");
    const nextId = nextStartStep(status.steps, status.stepIds, status.skipped);
    if (!nextId) {
      toast.success(tr("Primi passi completati"), {
        description: doneText,
        ...(pathname === OVERVIEW_PATH ? {} : { action: { label: tr("Vai alla Panoramica"), onClick: () => router.push(OVERVIEW_PATH) } }),
      });
      return;
    }
    if (pathname === OVERVIEW_PATH) {
      addRecentSteps(fresh);
      return;
    }
    const next = definitions.find((d) => d.id === nextId);
    if (!next) return;
    toast.success(doneText, {
      description: tr("Prossimo passo: {0}", { 0: tr(next.title) }),
      action: {
        label: tr(next.cta),
        onClick: () => {
          track("start_step_clicked", { step: next.id, placement: "toast" });
          router.push(next.href);
        },
      },
    });
    // Only a change in the steps' state should announce something, not navigating between pages.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return null;
}
