import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sito statico: la cartella `out/` si pubblica su Cloudflare Pages (nessun server Node).
  output: "export",
  images: { unoptimized: true },
  // Radice esplicita: nella repo c'è anche il progetto dell'app nella cartella superiore, che non va caricato.
  turbopack: { root: path.join(__dirname) },
};

export default nextConfig;
