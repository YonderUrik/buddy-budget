import { createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signJwt } from "./jwt";

function verify(jwt: string, publicKey: string, algorithm: "RS256" | "ES256"): boolean {
  const [header, payload, signature] = jwt.split(".");
  const verifier = createVerify("SHA256");
  verifier.update(`${header}.${payload}`);
  return verifier.verify(algorithm === "ES256" ? { key: publicKey, dsaEncoding: "ieee-p1363" } : publicKey, Buffer.from(signature, "base64url"));
}

describe("signJwt", () => {
  it("signs RS256 tokens for the Google service account", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
    const jwt = signJwt({ algorithm: "RS256", key: privateKey, claims: { iss: "a" } });
    expect(verify(jwt, publicKey, "RS256")).toBe(true);
    expect(JSON.parse(Buffer.from(jwt.split(".")[0], "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
  });

  it("signs ES256 tokens with the raw signature APNs expects and the key id in the header", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256", privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
    const jwt = signJwt({ algorithm: "ES256", key: privateKey, header: { kid: "K1" }, claims: { iss: "T1", iat: 1 } });
    expect(verify(jwt, publicKey, "ES256")).toBe(true);
    expect(Buffer.from(jwt.split(".")[2], "base64url")).toHaveLength(64);
    expect(JSON.parse(Buffer.from(jwt.split(".")[0], "base64url").toString())).toMatchObject({ alg: "ES256", kid: "K1" });
  });
});
