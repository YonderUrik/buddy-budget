import { connection } from "next/server";
import { hasAccounts } from "@/lib/auth/signup-gate";
import { authMethods } from "@/lib/instance/config";
import { isPublicDemoEnabled } from "@/lib/public-demo/config";
import { LoginClient } from "./login-client";

/** Path that opens the public demo (`app/demo/route.ts`). */
const PUBLIC_DEMO_PATH = "/demo";

/**
 * Login page: the public demo link appears only where the demo is enabled (read at request time, not at build time).
 * With password sign-in, an instance without accounts opens on «Crea il primo account».
 */
export default async function LoginPage() {
  await connection();
  const methods = authMethods();
  const firstAccount = methods.password && !(await hasAccounts());
  return (
    <LoginClient
      demoHref={isPublicDemoEnabled() ? PUBLIC_DEMO_PATH : undefined}
      firstAccount={firstAccount}
      signupOpen={methods.openSignup || firstAccount}
    />
  );
}
