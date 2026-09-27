import type { NextConfig } from "next";

import packageJson from "./package.json";
import { resolveBuildInfo } from "./lib/app-version/resolve";

// Versione/commit/istante di build, incollati nel bundle: l'etichetta versione in sidebar
// e /api/health cambiano solo con un nuovo deploy (vedi lib/app-version).
const buildInfo = resolveBuildInfo(packageJson.version);

const nextConfig: NextConfig = {
  // Build autosufficiente in .next/standalone (server.js + sole dipendenze usate): base dell'immagine Docker.
  // Vercel la ignora, quindi il deploy attuale non cambia.
  output: "standalone",
  env: {
    NEXT_PUBLIC_APP_VERSION: buildInfo.version,
    NEXT_PUBLIC_APP_COMMIT: buildInfo.commit,
    NEXT_PUBLIC_APP_BUILT_AT: buildInfo.builtAt,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  // La schermata Spese è stata rinominata Transazioni: mantiene validi i vecchi link/segnalibri.
  async redirects() {
    return [{ source: "/spese", destination: "/transazioni", permanent: true }];
  },
};

export default nextConfig;
