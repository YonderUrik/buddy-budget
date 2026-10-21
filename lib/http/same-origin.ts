/**
 * True when the request authenticates with `Authorization: Bearer` and sends no `Cookie` header: the native apps.
 * Such a request carries no ambient credentials, so a cross-site page cannot forge it (a browser cannot add the
 * header to a cross-origin request without a CORS preflight, which these routes do not allow).
 */
export function isBearerOnlyRequest(headers: Headers): boolean {
  const authorization = headers.get("authorization");
  return Boolean(authorization && /^bearer\s+\S/i.test(authorization) && !headers.get("cookie"));
}

/**
 * CSRF check for app routes that accept writes: cookie-authenticated requests must come from the app's own origin
 * (`APP_URL`, or the request URL when it is unset); bearer-only requests (native apps) pass without an `Origin`.
 */
export function isTrustedWriteOrigin(request: Request, appUrl: string | undefined = process.env.APP_URL): boolean {
  if (isBearerOnlyRequest(request.headers)) return true;
  return request.headers.get("origin") === new URL(appUrl || request.url).origin;
}
