/**
 * Link `mailto:` protetto dal marcatore `email_off`, così Cloudflare non lo sostituisce con `/cdn-cgi/l/email-protection`
 * (un link che i crawler vedono rotto). Stesso trucco di `legal-page.tsx`.
 */
export function MailLink({ email, className }: { email: string; className?: string }) {
  const cls = className ? ` class="${className}"` : "";
  const html = `<!--email_off--><a${cls} href="mailto:${email}">${email}</a><!--/email_off-->`;
  return <span style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: html }} />;
}
