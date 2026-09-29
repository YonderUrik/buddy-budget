import { RECENT_LOGIN_MAX_AGE_MINUTES } from "./constants";

/** True se la sessione è stata creata da non più di `RECENT_LOGIN_MAX_AGE_MINUTES` minuti (accesso recente). */
export function isRecentLogin(sessionCreatedAt: Date, now: Date = new Date()): boolean {
  const ageMs = now.getTime() - sessionCreatedAt.getTime();
  return ageMs >= 0 && ageMs <= RECENT_LOGIN_MAX_AGE_MINUTES * 60_000;
}

/** Istante in cui la sessione smette di valere come accesso recente. */
export function recentLoginExpiresAt(sessionCreatedAt: Date): Date {
  return new Date(sessionCreatedAt.getTime() + RECENT_LOGIN_MAX_AGE_MINUTES * 60_000);
}
