"use client";

import * as React from "react";
import { EyeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { authClient } from "@/lib/auth/client";
import { useLocalization } from "@/lib/localization/provider";
import { cn } from "@/lib/utils";

/** sessionStorage key: the «viewed» event is sent once per browser session, not on every page. */
const VIEWED_STORAGE_KEY = "bb.public-demo-viewed";
/** Where «Crea il tuo account» leads after leaving the demo session. */
const DEFAULT_SIGNUP_HREF = "/login";

export interface PublicDemoBannerProps {
  /** Page opened by «Crea il tuo account» once the demo session is closed. */
  signupHref?: string;
  className?: string;
}

/**
 * Strip shown on every screen of the public demo: says the data is invented and nothing is saved, and offers to
 * leave the demo and create a real account (signs out first, so the sign-in page opens clean).
 */
export function PublicDemoBanner({ signupHref = DEFAULT_SIGNUP_HREF, className }: PublicDemoBannerProps) {
  const { t, language } = useLocalization();
  const [leaving, setLeaving] = React.useState(false);

  React.useEffect(() => {
    try {
      if (sessionStorage.getItem(VIEWED_STORAGE_KEY)) return;
      sessionStorage.setItem(VIEWED_STORAGE_KEY, "1");
    } catch {
      // Blocked storage: the event may be sent more than once, which is harmless.
    }
    track("public_demo_viewed", { language });
  }, [language]);

  async function leaveDemo() {
    setLeaving(true);
    track("public_demo_signup_clicked", { language });
    await authClient.signOut().catch(() => undefined);
    // Full reload: no cached demo data stays in memory for the account that comes next.
    window.location.assign(signupHref);
  }

  return (
    <div
      role="status"
      className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-primary/10 px-4 py-3", className)}
    >
      <EyeIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
      <p className="min-w-0 flex-1 basis-60 text-sm text-foreground">
        <strong className="font-semibold">{t("Stai guardando la demo.")}</strong>{" "}
        {t("I dati sono inventati e le modifiche non si salvano.")}
      </p>
      <Button size="sm" className="h-11 px-4 sm:h-9" onClick={leaveDemo} disabled={leaving}>
        {t("Crea il tuo account")}
      </Button>
    </div>
  );
}
