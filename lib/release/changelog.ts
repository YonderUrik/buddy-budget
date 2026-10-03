/** Titolo del file CHANGELOG, riscritto in testa a ogni release. */
export const CHANGELOG_HEADER = "# Changelog\n\nTutte le modifiche rilevanti di BuddyBudget, versione per versione. Il file è generato da `pnpm release:prepare` (vedi `docs/rilasci.md`).\n";

const DEPENDENCY_SUBJECT = /^(chore|build)\(deps(-dev)?\)|^bump |^Bump /;
const MERGE_OR_RELEASE_SUBJECT = /^Merge |^Release v\d/;

/** Raggruppa i titoli dei commit (titoli di PR in squash merge) in "Modifiche" e "Dipendenze". */
export function groupSubjects(subjects: string[]): { changes: string[]; dependencies: string[] } {
  const changes: string[] = [];
  const dependencies: string[] = [];
  for (const raw of subjects) {
    const subject = raw.trim();
    if (!subject || MERGE_OR_RELEASE_SUBJECT.test(subject)) continue;
    (DEPENDENCY_SUBJECT.test(subject) ? dependencies : changes).push(subject);
  }
  return { changes, dependencies };
}

/** Sezione di changelog per una versione (`## X.Y.Z — AAAA-MM-GG`). */
export function renderChangelogSection(version: string, date: string, subjects: string[], note?: string): string {
  const { changes, dependencies } = groupSubjects(subjects);
  const lines = [`## ${version} — ${date}`, ""];
  if (note) lines.push(note, "");
  if (changes.length) lines.push("### Modifiche", "", ...changes.map((s) => `- ${s}`), "");
  if (dependencies.length) lines.push("### Dipendenze", "", ...dependencies.map((s) => `- ${s}`), "");
  if (!changes.length && !dependencies.length && !note) lines.push("Nessuna modifica rilevante.", "");
  return lines.join("\n");
}

/** Inserisce `section` subito dopo l'intestazione del changelog (voci nuove in cima). */
export function prependSection(changelog: string | null, section: string): string {
  const body = changelog?.startsWith(CHANGELOG_HEADER) ? changelog.slice(CHANGELOG_HEADER.length) : (changelog ?? "");
  return `${CHANGELOG_HEADER}\n${section}\n${body.replace(/^\n+/, "")}`.replace(/\n+$/, "\n");
}

/** Testo della sezione di una versione (senza il titolo), o `null` se manca. Usato per le note della GitHub Release. */
export function extractSection(changelog: string, version: string): string | null {
  const lines = changelog.split("\n");
  const start = lines.findIndex((l) => l.startsWith(`## ${version} `) || l === `## ${version}`);
  if (start === -1) return null;
  let end = lines.findIndex((l, i) => i > start && l.startsWith("## "));
  if (end === -1) end = lines.length;
  return lines.slice(start + 1, end).join("\n").trim();
}
