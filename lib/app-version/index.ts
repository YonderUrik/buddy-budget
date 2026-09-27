/**
 * Versione dell'app visibile all'utente. I valori sono incollati nel bundle a build time
 * da `next.config.ts` (vedi `resolveBuildInfo`), quindi cambiano solo con un nuovo deploy:
 * è proprio ciò che serve per capire se l'app in esecuzione è aggiornata.
 */

import type { BuildInfo } from "./resolve";

export type { BuildInfo } from "./resolve";

/** Lunghezza dello SHA abbreviato, allineata ai tag immagine `sha-xxxxxxx` della CI. */
export const SHORT_SHA_LENGTH = 7;

/** Build info dell'app in esecuzione (valori inlined da next.config). */
export const APP_BUILD_INFO: BuildInfo = {
  version: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0",
  commit: process.env.NEXT_PUBLIC_APP_COMMIT ?? "",
  builtAt: process.env.NEXT_PUBLIC_APP_BUILT_AT ?? "",
};

/** Etichetta compatta: "v0.1.0 · abc1234", oppure solo "v0.1.0" se il commit è ignoto. */
export function formatVersionLabel(info: BuildInfo): string {
  const base = `v${info.version}`;
  return info.commit ? `${base} · ${info.commit.slice(0, SHORT_SHA_LENGTH)}` : base;
}

/** Testo esteso per tooltip: versione, commit e data/ora di build. */
export function formatVersionDetails(info: BuildInfo, locale = "it-IT"): string {
  const lines = [`Versione ${info.version}`];
  if (info.commit) lines.push(`Commit ${info.commit.slice(0, SHORT_SHA_LENGTH)}`);
  const built = info.builtAt ? new Date(info.builtAt) : null;
  if (built && !Number.isNaN(built.getTime())) {
    lines.push(
      `Build ${built.toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}`
    );
  }
  return lines.join("\n");
}
