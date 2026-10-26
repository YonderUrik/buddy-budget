"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * «Dall'ultima visita»: when a returning user opens the app (any page) after something happened while they were away,
 * one short toast says it in a single line, with one action. Shown once per visit (the server remembers it, so not on
 * a second device either) and never again in the same visit, also when the component is mounted again. Also keeps the
 * visit alive with the heartbeat. Renders nothing; mounted once in the app layout, outside the section transition.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { track } from "@/lib/analytics";
import { WELCOME_QUERY_KEY, markWelcomeShown, useVisitHeartbeat, useWelcomeQuery } from "@/lib/queries/welcome";
import type { WelcomeResponse } from "@/lib/welcome";
import { happenedLine, waitingLine, welcomeToastContent } from "./welcome-lines";

/** Long enough to read one line, short enough not to sit on the page. */
const WELCOME_TOAST_MS = 5_000;
/** On the phone the toast comes from the top, so it never covers the bottom bar and the «Aggiungi» button. */
const PHONE_QUERY = "(max-width: 767px)";

export function WelcomeToast() {
  useVisitHeartbeat();
  const { t: tr } = useLocalization();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data } = useWelcomeQuery();

  React.useEffect(() => {
    const summary = data?.summary;
    if (!summary) return;
    // Forget it at once: a remount (or a refetch racing the PATCH) finds nothing to show again in this visit.
    queryClient.setQueryData<WelcomeResponse>(WELCOME_QUERY_KEY, { summary: null });
    const happened = summary.happened.map((item) => happenedLine(item, tr));
    const waiting = summary.waiting.map((item) => waitingLine(item, tr));
    const content = welcomeToastContent(happened, waiting, tr);
    if (!content) return;
    toast(<span className="block truncate">{content.line}</span>, {
      id: "welcome",
      duration: WELCOME_TOAST_MS,
      position: window.matchMedia(PHONE_QUERY).matches ? "top-center" : "bottom-right",
      action: {
        label: content.action.label,
        onClick: () => {
          track("welcome_summary_item_clicked", { item: content.action.kind });
          router.push(content.action.href);
        },
      },
    });
    track("welcome_summary_shown", { happened: happened.length, waiting: waiting.length });
    markWelcomeShown();
  }, [data, queryClient, router, tr]);

  return null;
}
