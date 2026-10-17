/**
 * components/domain/native — barrel file
 *
 * Bridge between the web app and the native shell (Capacitor): `NativeAppBridge` in the root layout (deep links,
 * Android back, status bar, notification taps), `NativeSessionTasks` and `BiometricLockScreen` in the authenticated
 * layout, the «Questo telefono» settings section. All of them render nothing in a browser.
 */

export { NativeAppBridge } from "./native-app-bridge";
export { NativeSessionTasks } from "./native-session-tasks";
export { BiometricLockScreen } from "./biometric-lock-screen";
export { useBiometricLock, useBiometricLockChoice } from "./use-biometric-lock";
export type { BiometricLock, BiometricLockState } from "./use-biometric-lock";
