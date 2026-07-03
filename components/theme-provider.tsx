"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * ThemeProvider
 *
 * Wrapper attorno a `next-themes` per il tema chiaro/scuro.
 *
 * NOTA — Warning React 19 "Encountered a script tag":
 * `next-themes` inietta un tag <script> inline per prevenire il FOUC
 * (flash of unstyled content) durante l'idratazione. React 19 emette un
 * warning a riguardo in dev-mode perché ha cambiato il modo in cui gestisce
 * i tag <script> nei componenti — ma il comportamento è corretto e intenzionale:
 * lo script gira lato server/SSR, non sul client.
 *
 * Il warning è puramente cosmetico in sviluppo e non ha impatto in produzione.
 * Il tema funziona correttamente: la class sull'elemento <html> viene impostata
 * dal server, e `suppressHydrationWarning` in `app/layout.tsx` gestisce la
 * differenza client/server senza errori di idratazione.
 *
 * Tracking: https://github.com/pacocoursey/next-themes/issues — risolto
 * upstream quando next-themes rilascerà una versione compatibile con React 19.
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

