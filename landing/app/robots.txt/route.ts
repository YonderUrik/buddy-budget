import { buildRobotsTxt } from "@/content/robots";

export const dynamic = "force-static";

/** `/robots.txt`: regole per i crawler e preferenze `Content-Signal` per l'uso dei contenuti da parte delle AI. */
export function GET() {
  return new Response(buildRobotsTxt(), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
