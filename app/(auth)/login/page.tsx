import { connection } from "next/server";
import { isPublicDemoEnabled } from "@/lib/public-demo/config";
import { LoginClient } from "./login-client";

/** Path that opens the public demo (`app/demo/route.ts`). */
const PUBLIC_DEMO_PATH = "/demo";

/** Login page: the public demo link appears only where the demo is enabled (read at request time, not at build time). */
export default async function LoginPage() {
  await connection();
  return <LoginClient demoHref={isPublicDemoEnabled() ? PUBLIC_DEMO_PATH : undefined} />;
}
