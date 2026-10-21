import { emailOTP } from "better-auth/plugins";
import { createAuthEndpoint } from "better-auth/api";

/**
 * Await delivery on the OTP send endpoint and preserve callback errors. Better-auth's default
 * runInBackgroundOrAwait catches them, which would report success even when no code was delivered.
 */
export function emailOTPWithDeliveryErrors(options: Parameters<typeof emailOTP>[0]) {
  const plugin = emailOTP(options);
  const send = plugin.endpoints.sendVerificationOTP;
  return {
    ...plugin,
    endpoints: {
      ...plugin.endpoints,
      sendVerificationOTP: createAuthEndpoint(send.path, send.options, async (ctx) => send({
        ...ctx,
        context: {
          ...ctx.context,
          runInBackgroundOrAwait: async (task: Promise<unknown>) => { await task; },
        },
        asResponse: false,
        returnHeaders: false,
        returnStatus: false,
      })),
    },
  };
}
