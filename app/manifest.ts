import type { MetadataRoute } from "next";

/**
 * Manifest PWA di BuddyBudget: rende l'app installabile su desktop, iOS e Android
 * ("Aggiungi a Home"/"Installa app"). Nessun service worker: l'app resta un client
 * che richiede rete, non funziona offline.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BuddyBudget",
    short_name: "BuddyBudget",
    description: "Gestione finanziaria personale — patrimonio, spese, investimenti.",
    start_url: "/",
    display: "standalone",
    // Valore letterale richiesto dal formato manifest (nessun accesso a CSS custom properties
    // in questo contesto) — tenere allineato a --sidebar/--background del tema scuro in globals.css.
    background_color: "#0f0f3f",
    theme_color: "#0f0f3f",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
