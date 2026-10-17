import { describe, expect, it } from "vitest";
import { nativeSignInConfigFromEnv, socialProvidersFromEnv } from "./social-providers";

describe("socialProvidersFromEnv", () => {
  it("leaves only the magic link without credentials", () => {
    expect(socialProvidersFromEnv({})).toEqual({});
    expect(socialProvidersFromEnv({ GOOGLE_CLIENT_ID: "web", GOOGLE_CLIENT_SECRET: " " })).toEqual({});
  });

  it("accepts the iOS client as a second Google audience", () => {
    expect(socialProvidersFromEnv({ GOOGLE_CLIENT_ID: "web", GOOGLE_CLIENT_SECRET: "s" }).google).toEqual({ clientId: "web", clientSecret: "s" });
    expect(socialProvidersFromEnv({ GOOGLE_CLIENT_ID: "web", GOOGLE_CLIENT_SECRET: "s", GOOGLE_IOS_CLIENT_ID: "ios" }).google).toEqual({
      clientId: ["web", "ios"],
      clientSecret: "s",
    });
  });

  it("turns Apple on with the bundle identifier alone", () => {
    expect(socialProvidersFromEnv({ APPLE_APP_BUNDLE_IDENTIFIER: "io.buddybudget.app" }).apple).toEqual({
      clientId: "io.buddybudget.app",
      clientSecret: "",
      appBundleIdentifier: "io.buddybudget.app",
    });
  });
});

describe("nativeSignInConfigFromEnv", () => {
  it("exposes only public client ids", () => {
    const config = nativeSignInConfigFromEnv({ GOOGLE_CLIENT_ID: "web", GOOGLE_CLIENT_SECRET: "secret", GOOGLE_IOS_CLIENT_ID: "ios", APPLE_APP_BUNDLE_IDENTIFIER: "b" });
    expect(config).toEqual({ google: { webClientId: "web", iosClientId: "ios" }, apple: true });
    expect(JSON.stringify(config)).not.toContain("secret");
    expect(nativeSignInConfigFromEnv({})).toEqual({ google: null, apple: false });
  });
});
