import { z } from "zod";

/**
 * A Flex Web Service token (digits, as IBKR generates it; letters accepted in case the format changes) and the
 * numeric id of a saved Flex Query. Never a username or password.
 */
export const ibkrFlexConnectSchema = z.object({
  token: z.string().trim().regex(/^[A-Za-z0-9]{10,64}$/),
  queryId: z.string().trim().regex(/^\d{1,12}$/),
}).strict();
export type IbkrFlexConnectInput = z.infer<typeof ibkrFlexConnectSchema>;
