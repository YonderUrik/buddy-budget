import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The app is a thin native shell: the WebView loads the deployed web app, so every release reaches phones without a
 * store update. `BUDDYBUDGET_APP_URL` points it elsewhere (a local `pnpm dev` on the LAN, a preview); `www/` is only
 * the page shown when the server cannot be reached.
 */
const appUrl = process.env.BUDDYBUDGET_APP_URL ?? "https://app.buddybudget.io";

const config: CapacitorConfig = {
  appId: "io.buddybudget.app",
  appName: "BuddyBudget",
  webDir: "www",
  server: {
    url: appUrl,
    // Only for a local http dev server; production is https.
    cleartext: appUrl.startsWith("http://"),
    errorPath: "offline.html",
  },
  // Lets the web app (and the server, from the User-Agent) tell the native app apart from a browser.
  appendUserAgent: "BuddyBudgetApp",
  ios: {
    // Content under the status bar is handled by the web app's safe-area padding (viewport-fit=cover).
    contentInset: "never",
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
