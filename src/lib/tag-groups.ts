// Tags named "Skupina: hodnota" form groups (Účet, Aktivita, Role, Tým, Kohorta, Věk…).
// A contact's grouped tags are refreshed as a whole on every re-import; plain tags stay.

export const CONSENT_TAGS = ["Smí obchodní sdělení", "Jen servisní e-maily"] as const;
const CONSENT_LOWER = new Set<string>(CONSENT_TAGS.map((t) => t.toLowerCase()));

export function tagGroup(name: string) {
  const n = name.trim().toLowerCase();
  if (CONSENT_LOWER.has(n)) return "consent";
  const i = n.indexOf(": ");
  return i > 0 ? n.slice(0, i) : null;
}

export function splitGroupedTag(name: string) {
  const i = name.indexOf(": ");
  return i > 0 ? { group: name.slice(0, i).trim(), value: name.slice(i + 2).trim() } : null;
}
