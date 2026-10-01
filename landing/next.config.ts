import path from "node:path";
import type { NextConfig } from "next";

/**
 * La landing è un sito interamente statico (`out/`), pensato per Cloudflare Pages: nessun server Node a runtime,
 * nessun accesso al DB dell'app. Tutto ciò che è dinamico (login, dati) vive su app.buddybudget.io.
 */
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  reactStrictMode: true,
  // La cartella vive dentro la repo dell'app: senza questo Turbopack risale al lockfile della radice e ne prende config e proxy.
  turbopack: { root: path.resolve(process.cwd()) },
};

export default nextConfig;
