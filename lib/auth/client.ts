import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields, magicLinkClient } from "better-auth/client/plugins";
import type { auth } from "./index";

/** Client better-auth per componenti React (stessa origine dell'app, nessun baseURL). Non importare in file server-only. */
export const authClient = createAuthClient({
  plugins: [
    magicLinkClient(),
    inferAdditionalFields<typeof auth>(),
  ],
});
