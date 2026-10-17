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
    // Edge to edge: the web app pads its top bar and pages with env(safe-area-inset-*) (viewport-fit=cover).
    contentInset: "never",
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    // Only Google and Apple are bundled: the other providers would add SDKs (Facebook, Twitter) the app does not use.
    SocialLogin: {
      providers: { google: true, apple: true, facebook: false, twitter: false },
    },
    // Badge, sound and banner when a notification arrives with the app in the foreground.
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    // Android follows viewport-fit=cover like iOS: edge to edge, with correct env(safe-area-inset-*) values.
    SystemBars: {
      insetsHandling: "css",
      initialViewportFitValueHint: "cover",
    },
    // The web app hides the splash as soon as its first screen is drawn (`NativeAppBridge`), so there is no white
    // flash; the timeout is the safety net (slow network, offline page).
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2500,
      backgroundColor: "#ffffff",
    },
  },
};

export default config;
