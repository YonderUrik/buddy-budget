import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields, magicLinkClient } from "better-auth/client/plugins";
import type { auth } from "./index";

/** Client better-auth per componenti React. Non importare in file server-only. */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  plugins: [
    magicLinkClient(),
    inferAdditionalFields<typeof auth>(),
  ],
});
