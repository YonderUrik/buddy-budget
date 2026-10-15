import { FEATURE_AREAS, featuresByArea } from "./country-catalog";
import { FAQ, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "./site";
import { ITALY } from "./home";
import { t, localPath, PROFILE } from "@/lib/localization";
export function buildLlmsTxt(): string {
 const lines = [`# ${SITE_NAME}`, "", `> ${t(SITE_DESCRIPTION)}`, ""];
 if (PROFILE.country === "IT") lines.push(...ITALY.rules.map(r => `- ${t(r.rule)} ${t(r.app)}`), "");
 for (const area of FEATURE_AREAS) {
  const features = featuresByArea(area).filter(f => f.status !== "soon");
  if (!features.length) continue;
  lines.push(`## ${t(area)}`, "", ...features.map(f => `- **${t(f.name)}**: ${t(f.description)}`), "");
 }
 lines.push(`## ${t("Domande frequenti")}`, "");
 for (const q of FAQ) lines.push(`### ${t(q.question)}`, "", t(q.answer), "");
 for (const [path, label] of [["/funzioni","Funzioni"],["/strumenti","Calcolatori"],["/sicurezza","Sicurezza"],["/privacy","Privacy"],["/termini","Termini"],["/cookie","Cookie"]]) lines.push(`- [${t(label)}](${SITE_URL}${localPath(path)})`);
 return lines.join("\n") + "\n";
}
