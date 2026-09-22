import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
