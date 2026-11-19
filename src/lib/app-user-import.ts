import { tagGroup } from "@/lib/tag-groups";

type Row = Record<string, string>;

export const APP_SOURCE = "Aplikace NEXT8";
const AGE_NO_CONSENT = "do 15 let";

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

function splitTags(v: string | undefined) {
  return (v ?? "")
    .split(/[,;]/)
    .map((t) => t.trim().replace(/\s+/g, " ").slice(0, 60))
    .filter(Boolean);
}

// One row of the NEXT8 app export → a contact row. Same rules every time, so the
// raw export can be re-imported as is and the CRM catches up with the app:
// - missing names fall back to the nickname / e-mail, the CRM needs both names;
// - commercial messages only with the app's consent AND not for under-15s
//   (in CZ their consent has to come from a parent);
// - all app tags are kept, made into groups where they come in pairs so a
//   re-import replaces them; teams become "Tým: …"; consent decides the
//   "Smí obchodní sdělení" / "Jen servisní e-maily" tag.
export function appUserToContactRow(r: Row): Row | null {
  const email = r.email?.trim();
  if (!email) return null;
  const firstName = r.firstName?.trim() || r.nickname?.trim() || email.split("@")[0];
  const lastName = r.lastName?.trim() || "(bez příjmení)";

  const raw = splitTags(r.tags);
  const minor =
    norm(r.ageCategory) === AGE_NO_CONSENT || raw.some((t) => norm(t) === `věk: ${AGE_NO_CONSENT}`);
  const consent = ["ano", "yes", "true", "1"].includes(norm(r.marketingConsent)) && !minor;

  const tags = [
    APP_SOURCE,
    ...raw
      .filter((t) => tagGroup(t) !== "consent")
      .map((t) => t.replace(/^Push (zapnutý|vypnutý)$/i, (_, v: string) => `Push: ${v.toLowerCase()}`)),
    ...splitTags(r.teams).map((t) => `Tým: ${t}`),
    consent ? "Smí obchodní sdělení" : "Jen servisní e-maily",
  ];

  return {
    firstName,
    lastName,
    email,
    marketingConsent: consent ? "ano" : "ne",
    source: APP_SOURCE,
    tags: [...new Set(tags)].join(", "),
  };
}

