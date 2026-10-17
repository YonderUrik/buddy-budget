import { createSign } from "node:crypto";

function base64Url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

/**
 * Signed JWT for the push providers, with Node's crypto only: RS256 for the Google service account (FCM OAuth),
 * ES256 for APNs. ES256 signatures are in the raw `r||s` form JWT requires, not DER.
 */
export function signJwt(input: { algorithm: "RS256" | "ES256"; key: string; header?: Record<string, string>; claims: Record<string, unknown> }): string {
  const header = base64Url(JSON.stringify({ alg: input.algorithm, typ: "JWT", ...input.header }));
  const payload = base64Url(JSON.stringify(input.claims));
  const signingInput = `${header}.${payload}`;
  const signer = createSign("SHA256");
  signer.update(signingInput);
  const signature = signer.sign(input.algorithm === "ES256" ? { key: input.key, dsaEncoding: "ieee-p1363" } : input.key);
  return `${signingInput}.${base64Url(signature)}`;
}
