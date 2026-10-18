import { describe, expect, it } from "vitest";
import { createLogger } from "@/lib/observability";
import { DEV_OTP_LOG_EVENT, canLogDevOtp, logDevOtp } from "./otp-dev-log";

function capture() {
  const lines: string[] = [];
  return { lines, log: createLogger({ level: "debug", write: (line) => lines.push(line) }) };
}

describe("logDevOtp", () => {
  it("writes the code at info level with the dev-only event outside production", () => {
    for (const nodeEnv of ["development", "test", undefined]) {
      const { lines, log } = capture();
      expect(logDevOtp("123456", { nodeEnv: nodeEnv ?? "development", log })).toBe(true);
      expect(lines).toHaveLength(1);
      expect(JSON.parse(lines[0])).toMatchObject({ level: "info", event: DEV_OTP_LOG_EVENT, devCode: "123456" });
    }
  });

  it("never writes the code in production", () => {
    const { lines, log } = capture();
    expect(logDevOtp("123456", { nodeEnv: "production", log })).toBe(false);
    expect(lines).toEqual([]);
    expect(canLogDevOtp("production")).toBe(false);
  });

  it("reads NODE_ENV when no environment is passed", () => {
    expect(canLogDevOtp()).toBe(process.env.NODE_ENV !== "production");
  });
});
