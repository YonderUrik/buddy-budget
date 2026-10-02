import type { NextConfig } from "next";

import packageJson from "./package.json";
import { resolveBuildInfo } from "./lib/app-version/resolve";

// Versione/commit/istante di build, incollati nel bundle: l'etichetta versione in sidebar
// e /api/health cambiano solo con un nuovo deploy (vedi lib/app-version).
const buildInfo = resolveBuildInfo(packageJson.version);

/** Header di sicurezza per ogni risposta (art. 32 GDPR). Niente CSP per ora: richiede una taratura su Umami e gli stili inline. */
export const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

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
  // Spese, Transazioni, Cash flow e Categorie sono confluite in Movimenti: i vecchi link, i segnalibri e le pagine
  // iniziali già salvate nel profilo continuano a funzionare.
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  async redirects() {
    return [
      { source: "/spese", destination: "/movimenti", permanent: true },
      { source: "/transazioni", destination: "/movimenti", permanent: true },
      { source: "/cash-flow", destination: "/movimenti/analisi", permanent: true },
      { source: "/categorie", destination: "/movimenti/categorie", permanent: true },
    ];
  },
};

export default nextConfig;
