import { describe, expect, it } from "vitest";
import { pushConfigFromEnv } from "./config";

const SERVICE_ACCOUNT = { project_id: "bb", client_email: "push@bb.iam.gserviceaccount.com", private_key: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n" };

describe("pushConfigFromEnv", () => {
  it("is off without credentials", () => {
    expect(pushConfigFromEnv({})).toEqual({ fcm: null, apns: null });
  });

  it("reads the service account as JSON or base64", () => {
    const json = JSON.stringify(SERVICE_ACCOUNT);
    const expected = { projectId: "bb", clientEmail: SERVICE_ACCOUNT.client_email, privateKey: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n" };
    expect(pushConfigFromEnv({ FCM_SERVICE_ACCOUNT: json }).fcm).toEqual(expected);
    expect(pushConfigFromEnv({ FCM_SERVICE_ACCOUNT: Buffer.from(json).toString("base64") }).fcm).toEqual(expected);
  });

  it("treats a malformed service account as missing", () => {
    expect(pushConfigFromEnv({ FCM_SERVICE_ACCOUNT: "{not json" }).fcm).toBeNull();
    expect(pushConfigFromEnv({ FCM_SERVICE_ACCOUNT: JSON.stringify({ project_id: "bb" }) }).fcm).toBeNull();
  });

  it("needs key, key id and team id for APNs, with production as the default host", () => {
    expect(pushConfigFromEnv({ APNS_KEY: "-----BEGIN PRIVATE KEY-----\\nk\\n-----END PRIVATE KEY-----", APNS_KEY_ID: "K1" }).apns).toBeNull();
    const apns = pushConfigFromEnv({ APNS_KEY: "-----BEGIN PRIVATE KEY-----\\nk\\n-----END PRIVATE KEY-----", APNS_KEY_ID: "K1", APNS_TEAM_ID: "T1" }).apns;
    expect(apns).toEqual({ key: "-----BEGIN PRIVATE KEY-----\nk\n-----END PRIVATE KEY-----", keyId: "K1", teamId: "T1", bundleId: "io.buddybudget.app", host: "api.push.apple.com" });
    expect(pushConfigFromEnv({ APNS_KEY: "x-----", APNS_KEY_ID: "K1", APNS_TEAM_ID: "T1", APNS_ENVIRONMENT: "sandbox" }).apns?.host).toBe("api.sandbox.push.apple.com");
  });
});
