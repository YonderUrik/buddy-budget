import { APP_BUILD_INFO, formatVersionDetails, formatVersionLabel, type BuildInfo } from "@/lib/app-version";
import { cn } from "@/lib/utils";

interface AppVersionLabelProps {
  /** Build da mostrare. Default: quella dell'app in esecuzione. */
  info?: BuildInfo;
  /** Se true mostra solo il semver (sidebar icon-only); i dettagli restano nel tooltip. */
  compact?: boolean;
  className?: string;
}

/**
 * Etichetta discreta con versione e commit della build (es. "v0.1.0 · d14089a"), con
 * data di build nel tooltip. Serve a capire a colpo d'occhio se l'app si è aggiornata.
 */
export function AppVersionLabel({ info = APP_BUILD_INFO, compact = false, className }: AppVersionLabelProps) {
  const details = formatVersionDetails(info);
  return (
    <p
      className={cn("truncate font-mono text-[11px] leading-none tabular-nums", className)}
      title={details}
      aria-label={details.replaceAll("\n", ", ")}
    >
      {compact ? `v${info.version}` : formatVersionLabel(info)}
    </p>
  );
}
