import { describe, expect, it, vi } from "vitest";
import { sendPushToDevices, type PushSendDeps } from "./send";

const MESSAGE = { title: "Rata in arrivo", body: "Mutuo: scade il 20 ottobre.", path: "/debiti" };
const APNS = { key: "k", keyId: "K", teamId: "T", bundleId: "io.buddybudget.app", host: "api.push.apple.com" };
const FCM = { projectId: "bb", clientEmail: "e", privateKey: "k" };

function deps(overrides: Partial<PushSendDeps> = {}): PushSendDeps {
  return {
    config: { fcm: FCM, apns: APNS },
    sendFcm: vi.fn(async () => "sent" as const),
    sendApns: vi.fn(async () => "sent" as const),
    deleteTokens: vi.fn(async () => undefined),
    record: vi.fn(),
    ...overrides,
  };
}

describe("sendPushToDevices", () => {
  it("uses APNs for iPhones and FCM for Android phones", async () => {
    const d = deps();
    const result = await sendPushToDevices([{ platform: "ios", token: "i1" }, { platform: "android", token: "a1" }], "deadlines", MESSAGE, d);
    expect(result).toEqual({ sent: 2, failed: 0, removed: 0, unconfigured: 0 });
    expect(d.sendApns).toHaveBeenCalledWith(APNS, "i1", MESSAGE);
    expect(d.sendFcm).toHaveBeenCalledWith(FCM, "a1", MESSAGE);
    expect(d.record).toHaveBeenCalledWith("deadlines", "ios", "sent");
  });

  it("deletes dead tokens and counts failures without throwing", async () => {
    const d = deps({
      sendFcm: vi.fn(async (_c, token: string) => (token === "dead" ? ("invalid_token" as const) : ("failed" as const))),
      sendApns: vi.fn(async () => {
        throw new Error("network");
      }),
    });
    const result = await sendPushToDevices([{ platform: "android", token: "dead" }, { platform: "android", token: "a2" }, { platform: "ios", token: "i1" }], "budget", MESSAGE, d);
    expect(result).toEqual({ sent: 0, failed: 2, removed: 1, unconfigured: 0 });
    expect(d.deleteTokens).toHaveBeenCalledWith(["dead"]);
  });

  it("skips a platform without credentials", async () => {
    const d = deps({ config: { fcm: null, apns: APNS } });
    const result = await sendPushToDevices([{ platform: "android", token: "a1" }], "digest", MESSAGE, d);
    expect(result).toEqual({ sent: 0, failed: 0, removed: 0, unconfigured: 1 });
    expect(d.record).toHaveBeenCalledWith("digest", "android", "not_configured");
  });
});
