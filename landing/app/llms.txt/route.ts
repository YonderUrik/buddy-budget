import { buildLlmsTxt } from "@/content/llms";

export const dynamic = "force-static";

/** `/llms.txt`: riassunto del sito per gli assistenti AI, generato a ogni build dalle stesse fonti della pagina. */
export function GET() {
  return new Response(buildLlmsTxt(), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
