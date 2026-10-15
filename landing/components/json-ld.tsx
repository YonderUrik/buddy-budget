import { localizedSchema } from "@/lib/localization/metadata";
/** Inserisce dati strutturati schema.org; il `<` è escluso dal JSON per evitare la chiusura anticipata dello script. */
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(localizedSchema(data)).replace(/</g, "\\u003c") }} />;
}
