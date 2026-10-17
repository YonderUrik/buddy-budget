import { describe, expect, it } from "vitest";
import { androidAssetLinks, appleAppSiteAssociation, nativeAppLinkConfigFromEnv } from "./app-links";

describe("native app links", () => {
  it("answers nothing without configuration", () => {
    const config = nativeAppLinkConfigFromEnv({ NATIVE_IOS_APP_ID: "", NATIVE_ANDROID_PACKAGE: "io.buddybudget.app" });
    expect(appleAppSiteAssociation(config)).toBeNull();
    expect(androidAssetLinks(config)).toBeNull();
  });

  it("lists the magic link path for iOS", () => {
    expect(appleAppSiteAssociation({ iosAppId: "TEAM.io.buddybudget.app" })).toEqual({
      applinks: { details: [{ appIDs: ["TEAM.io.buddybudget.app"], components: [{ "/": "/api/auth/magic-link/verify" }] }] },
    });
  });

  it("splits the Android fingerprints", () => {
    const links = androidAssetLinks({ androidPackage: "io.buddybudget.app", androidCertSha256: "AA:BB, CC:DD" });
    expect(links?.[0]).toMatchObject({ target: { package_name: "io.buddybudget.app", sha256_cert_fingerprints: ["AA:BB", "CC:DD"] } });
  });
});
