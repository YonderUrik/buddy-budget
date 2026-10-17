import { nativePlatform } from "./shell";

/** localStorage key of the «unlock with Face ID / fingerprint» choice: it belongs to this phone, like the theme. */
export const BIOMETRIC_LOCK_KEY = "bb:native:biometric-lock";
/** Coming back within this time does not ask again (switching app to copy a code, answering a message). */
export const BIOMETRIC_GRACE_MS = 30_000;

export type BiometricKind = "face" | "fingerprint" | "other";

/** What this phone offers: null outside the app or without biometrics/passcode set up. */
export async function biometricAvailability(): Promise<BiometricKind | null> {
  const platform = nativePlatform();
  if (!platform) return null;
  try {
    const { NativeBiometric, BiometryType } = await import("@capgo/capacitor-native-biometric");
    // The passcode fallback exists only on iOS: on Android the prompt needs an enrolled fingerprint or face.
    const result = await NativeBiometric.isAvailable({ useFallback: platform === "ios" });
    if (!result.isAvailable) return null;
    if (result.biometryType === BiometryType.FACE_ID || result.biometryType === BiometryType.FACE_AUTHENTICATION) return "face";
    if (result.biometryType === BiometryType.TOUCH_ID || result.biometryType === BiometryType.FINGERPRINT) return "fingerprint";
    return "other";
  } catch {
    return null;
  }
}

/**
 * Asks Face ID / fingerprint (with the phone passcode as fallback). Resolves true when the person is verified.
 * A convenience lock on a phone already unlocked, not a security boundary: the session is the server's.
 */
export async function verifyWithBiometrics(texts: { reason: string; cancel: string }): Promise<boolean> {
  try {
    const { NativeBiometric } = await import("@capgo/capacitor-native-biometric");
    await NativeBiometric.verifyIdentity({ reason: texts.reason, title: "BuddyBudget", negativeButtonText: texts.cancel, useFallback: true, maxAttempts: 3 });
    return true;
  } catch {
    return false;
  }
}
