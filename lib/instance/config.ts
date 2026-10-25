import { isLocalMode } from "@/lib/selfhost/local-mode";
import { emailTransport, isEmailConfigured } from "@/lib/email/transport";

type Env = Record<string, string | undefined>;

/** `true`/`false` (also `1`/`0`, `yes`/`no`) from an env value; anything else, empty included, is `undefined`. */
export function parseFlag(value: string | undefined): boolean | undefined {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  return undefined;
}

/** True on a self-hosted install (`SELF_HOSTED=true`, set by docker-compose.yml). The hosted version never sets it. */
export function isSelfHosted(env: Env = process.env): boolean {
  return parseFlag(env.SELF_HOSTED) === true;
}

/** Sign-in methods this instance offers. */
export interface AuthMethods {
  /** Email and password. */
  password: boolean;
  /** Emailed sign-in link (without an email service the link is printed in the server log). */
  magicLink: boolean;
  /** «Continua con Google», only with both OAuth credentials. */
  google: boolean;
  /** The instance can send emails, so «Password dimenticata?» can email a reset link. */
  emailDelivery: boolean;
  /** Anyone can create an account; when false only the first account of the instance can be created. */
  openSignup: boolean;
}

/** What the browser needs to know about this instance: self-hosted or not, and how people sign in. */
export interface InstanceConfig {
  selfHosted: boolean;
  auth: AuthMethods;
}

/**
 * Sign-in methods from the environment. Password: `AUTH_PASSWORD`, by default on when self-hosted or when no email
 * service is configured. Magic link: whenever emails can be sent, and as the only method when password is off.
 * Signups: `ALLOW_SIGNUPS`, by default open on the hosted version and first account only when self-hosted.
 */
export function authMethods(env: Env = process.env): AuthMethods {
  const selfHosted = isSelfHosted(env);
  const local = isLocalMode(env);
  const emailDelivery = isEmailConfigured(env);
  const password = parseFlag(env.AUTH_PASSWORD) ?? (selfHosted || !emailDelivery);
  return {
    password: !local && password,
    magicLink: !local && (emailDelivery || !password),
    google: !local && Boolean(env.GOOGLE_CLIENT_ID?.trim() && env.GOOGLE_CLIENT_SECRET?.trim()),
    emailDelivery,
    openSignup: !local && (parseFlag(env.ALLOW_SIGNUPS) ?? !selfHosted),
  };
}

/** Instance configuration read at request time (never inlined at build time: the same image serves every install). */
export function instanceConfig(env: Env = process.env): InstanceConfig {
  return { selfHosted: isSelfHosted(env), auth: authMethods(env) };
}

/** One-line summary for the boot log, e.g. `self-hosted password=on link=off google=off email=smtp signups=first-account`. */
export function describeInstance(env: Env = process.env): string {
  const auth = authMethods(env);
  const on = (value: boolean) => (value ? "on" : "off");
  return [
    isSelfHosted(env) ? "self-hosted" : "hosted",
    `password=${on(auth.password)}`,
    `link=${auth.magicLink ? (auth.emailDelivery ? "email" : "log") : "off"}`,
    `google=${on(auth.google)}`,
    `email=${emailTransport(env) ?? "off"}`,
    `signups=${auth.openSignup ? "open" : "first-account"}`,
  ].join(" ");
}

/** What the hosted version offers: the default for components rendered outside `InstanceProvider` (tests, previews). */
export const HOSTED_INSTANCE: InstanceConfig = {
  selfHosted: false,
  auth: { password: false, magicLink: true, google: true, emailDelivery: true, openSignup: true },
};
