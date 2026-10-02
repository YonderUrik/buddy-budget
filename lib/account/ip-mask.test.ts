import { describe, expect, it } from "vitest";
import { truncateIp } from "./ip-mask";

describe("truncateIp", () => {
  it("azzera l'ultimo ottetto di un IPv4", () => {
    expect(truncateIp("203.0.113.45")).toBe("203.0.113.0");
    expect(truncateIp(" 10.1.2.3 ")).toBe("10.1.2.0");
  });

  it("tratta un IPv4 mappato su IPv6 come IPv4", () => {
    expect(truncateIp("::ffff:192.168.1.77")).toBe("192.168.1.0");
  });

  it("tiene i primi tre gruppi di un IPv6, anche abbreviato", () => {
    expect(truncateIp("2001:db8:85a3:8d3:1319:8a2e:370:7348")).toBe("2001:db8:85a3:0:0:0:0:0");
    expect(truncateIp("2001:db8::1")).toBe("2001:db8:0:0:0:0:0:0");
    expect(truncateIp("::1")).toBe("0:0:0:0:0:0:0:0");
  });

  it("non salva ciò che non sa mascherare", () => {
    expect(truncateIp(null)).toBeNull();
    expect(truncateIp(undefined)).toBeNull();
    expect(truncateIp("")).toBeNull();
    expect(truncateIp("non-un-ip")).toBeNull();
    expect(truncateIp("1:2:3:4:5:6:7:8:9")).toBeNull();
  });
});
