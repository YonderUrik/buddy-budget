import { nativePlatform } from "./shell";

/**
 * Opens a page outside the app's WebView: in-app browser sheet (SFSafariViewController / Chrome Custom Tabs) inside
 * the native app, the same tab in a browser. Used for the bank consent, which banks do not allow inside a WebView.
 */
export async function openExternalPage(url: string, options: { onClosed?: () => void } = {}): Promise<void> {
  if (!nativePlatform()) {
    window.location.href = url;
    return;
  }
  const { Browser } = await import("@capacitor/browser");
  if (options.onClosed) {
    // The sheet closes when the person dismisses it or when the app takes the link back: either way the caller resets.
    const handle = await Browser.addListener("browserFinished", () => {
      void handle.remove();
      options.onClosed?.();
    });
  }
  await Browser.open({ url, presentationStyle: "fullscreen" });
}

/** Closes the in-app browser sheet if it is open (no-op in a browser or when nothing is open). */
export async function closeExternalPage(): Promise<void> {
  if (!nativePlatform()) return;
  const { Browser } = await import("@capacitor/browser");
  await Browser.close().catch(() => undefined);
}
