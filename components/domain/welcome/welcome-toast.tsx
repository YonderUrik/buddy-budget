"use client";
import { localizedFormats } from "@/lib/localization/format";
import { useLocalization } from "@/lib/localization/provider";

/**
 * «Dall'ultima visita»: when a returning user opens the app (any page), one toast says what happened while they were
 * away and what waits for them, with one action. Shown once per visit (the server remembers it, so not on a second
 * device either). Also keeps the visit alive with the heartbeat. Renders nothing; mounted once in the app layout.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { track } from "@/lib/analytics";
import { markWelcomeShown, useVisitHeartbeat, useWelcomeQuery } from "@/lib/queries/welcome";
import { happenedLine, waitingLine, welcomeToastContent } from "./welcome-lines";

/** Long enough to read two lines, short enough not to sit on the page. */
const WELCOME_TOAST_MS = 10_000;

export function WelcomeToast() {
  useVisitHeartbeat();
  const { t: tr, locale } = useLocalization();
  const router = useRouter();
  const { data } = useWelcomeQuery();
  const shownSince = React.useRef<string | null>(null);

  React.useEffect(() => {
    const summary = data?.summary;
    if (!summary || shownSince.current === summary.since) return;
    shownSince.current = summary.since;
    const { formatCurrency, formatPrice } = localizedFormats(locale);
    const currency = data.currency;
    const fmt = {
      money: (value: number) => formatCurrency(value, currency, { maximumFractionDigits: Math.abs(value) < 100 ? 2 : 0 }),
      price: formatPrice,
    };
    const happened = summary.happened.map((item) => happenedLine(item, tr, fmt));
    const waiting = summary.waiting.map((item) => waitingLine(item, tr));
    const content = welcomeToastContent(happened, waiting, tr);
    if (!content) return;
    toast(content.title, {
      id: "welcome",
      description: content.description,
      duration: WELCOME_TOAST_MS,
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
  }, [data, locale, router, tr]);

  return null;
}
