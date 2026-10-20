"use client";
import { APP_BUILD_INFO, formatVersionDetails, formatVersionLabel, type BuildInfo } from "@/lib/app-version";
import { useLocalization } from "@/lib/localization/provider";
import { cn } from "@/lib/utils";

interface AppVersionLabelProps {
  /** Build da mostrare. Default: quella dell'app in esecuzione. */
  info?: BuildInfo;
  /** Se true mostra solo il semver (sidebar icon-only); i dettagli restano nel tooltip. */
  compact?: boolean;
  className?: string;
}

/**
 * Discreet label with the build version and commit (e.g. "v0.1.0 · d14089a"), build date in the tooltip: shows at a
 * glance whether the app has updated. Hidden in the landing screenshots (`data-capture-hidden`), where it changed every
 * image at every commit.
 */
export function AppVersionLabel({ info = APP_BUILD_INFO, compact = false, className }: AppVersionLabelProps) {
  const { locale } = useLocalization();
  const details = formatVersionDetails(info, locale);
  return (
    <p
      className={cn("truncate text-[11px] leading-none tabular-nums", className)}
      data-capture-hidden
      title={details}
      aria-label={details.replaceAll("\n", ", ")}
    >
      {compact ? `v${info.version}` : formatVersionLabel(info)}
    </p>
  );
}
