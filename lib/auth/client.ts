import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields, lastLoginMethodClient, magicLinkClient } from "better-auth/client/plugins";
import type { auth } from "./index";

/** Client better-auth per componenti React (stessa origine dell'app, nessun baseURL). Non importare in file server-only. */
export const authClient = createAuthClient({
  plugins: [
    magicLinkClient(),
    lastLoginMethodClient(),
    inferAdditionalFields<typeof auth>(),
  ],
});
