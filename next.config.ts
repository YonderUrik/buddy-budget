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
  // La schermata Spese è stata rinominata Transazioni: mantiene validi i vecchi link/segnalibri.
  async redirects() {
    return [{ source: "/spese", destination: "/transazioni", permanent: true }];
  },
};

export default nextConfig;
