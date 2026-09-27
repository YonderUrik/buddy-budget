import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build autosufficiente in .next/standalone (server.js + sole dipendenze usate): base dell'immagine Docker.
  // Vercel la ignora, quindi il deploy attuale non cambia.
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  // Mapping esplicito: garantisce l'inlining a build-time anche se l'individuazione automatica
  // di NEXT_PUBLIC_* non lo rilevasse nei Server Component (unica occorrenza in questo progetto).
  env: {
    NEXT_PUBLIC_UMAMI_SRC: process.env.NEXT_PUBLIC_UMAMI_SRC,
    NEXT_PUBLIC_UMAMI_WEBSITE_ID: process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID,
  },
  // La schermata Spese è stata rinominata Transazioni: mantiene validi i vecchi link/segnalibri.
  async redirects() {
    return [{ source: "/spese", destination: "/transazioni", permanent: true }];
  },
};

export default nextConfig;
